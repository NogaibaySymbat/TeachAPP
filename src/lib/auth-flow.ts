"use client";

import { ApiRequestError } from "@/lib/api";
import { clearAuthCallbackSnapshot, getAuthCallbackSnapshot, getAuthClient } from "@/lib/auth-client";
import { getAnonymousId, resetAnonymousId } from "@/lib/anon-id";

const historyMarker = "businesscup26.account-history";
type HistoryLinkResult = "linked" | "already-linked" | "other-account";
const pendingLinks = new Map<string, Promise<HistoryLinkResult>>();
const invalidLinkMessage = "Не удалось подтвердить вход. Попробуйте войти через Google ещё раз или запросите новую ссылку по email.";

export async function loginWithGoogle(): Promise<void> {
  const client = getAuthClient();
  if (!client) throw new Error("Вход через Google пока не настроен. Попробуйте позже.");
  try {
    const { data, error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error || !data.url) throw new Error("Google sign-in did not start.");
    // The browser SDK navigates to the provider. Existing account state is
    // preserved until a successful callback confirms the replacement session.
  } catch {
    throw new Error("Не удалось открыть вход через Google. Повторите попытку.");
  }
}

export function clearHistoryLinkMarker() {
  localStorage.removeItem(historyMarker);
}

export function linkGuestHistory(accountId: string): Promise<HistoryLinkResult> {
  const guestId = getAnonymousId();
  const key = `${accountId}:${guestId}`;
  if (localStorage.getItem(historyMarker) === key) return Promise.resolve("already-linked");
  const pending = pendingLinks.get(key);
  if (pending) return pending;

  const request = (async (): Promise<HistoryLinkResult> => {
    const client = getAuthClient();
    if (!client) throw new Error("Вход пока недоступен. Попробуйте позже.");
    const before = await client.auth.getSession();
    if (before.error || before.data.session?.user.id !== accountId) {
      throw new Error("Аккаунт изменился. Обновите страницу, чтобы продолжить.");
    }
    const accessToken = before.data.session.access_token;
    let result: HistoryLinkResult = "linked";
    try {
      // Keep this mutation bound to the exact account and guest that were checked.
      const response = await fetch("/api/auth/claim", {
        method: "POST",
        headers: { authorization: `Bearer ${accessToken}`, "x-anonymous-id": guestId },
        cache: "no-store",
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new ApiRequestError(
          data?.error?.message ?? "Не удалось сохранить гостевую историю. Повторите попытку.",
          data?.error?.code ?? "REQUEST_FAILED",
          response.status,
        );
      }
      if (!data?.claimed) throw new Error("Не удалось сохранить гостевую историю. Повторите попытку.");
    } catch (cause) {
      if (!(cause instanceof ApiRequestError) || cause.status !== 409 || cause.code !== "GUEST_HISTORY_UNAVAILABLE") throw cause;
      result = "other-account";
    }
    const after = await client.auth.getSession();
    if (after.error || after.data.session?.user.id !== accountId) {
      throw new Error("Аккаунт изменился. Обновите страницу, чтобы продолжить.");
    }
    // Another tab may already have retired this guest while the request was pending.
    if (getAnonymousId() === guestId) {
      const freshGuestId = resetAnonymousId();
      localStorage.setItem(historyMarker, `${accountId}:${freshGuestId}`);
    }
    window.dispatchEvent(new Event("study-history-updated"));
    return result;
  })();
  pendingLinks.set(key, request);
  void request.finally(() => pendingLinks.delete(key)).catch(() => {});
  return request;
}

export async function verifySignInLink(): Promise<string> {
  const snapshot = getAuthCallbackSnapshot();
  const url = new URL(snapshot?.href ?? window.location.href);
  try {
    const fragment = new URLSearchParams(url.hash.slice(1));
    if (["error", "error_code", "error_description"].some((key) => url.searchParams.has(key) || fragment.has(key))) {
      throw new Error(invalidLinkMessage);
    }
    const tokenHash = url.searchParams.get("token_hash");
    const callbackToken = fragment.get("access_token");
    // The SDK lets query values override fragment values and uses the last
    // duplicate. Reject ambiguity so the captured token is the one it verifies.
    if (url.searchParams.has("access_token") || url.searchParams.has("refresh_token")
      || fragment.getAll("access_token").length > 1 || fragment.getAll("refresh_token").length > 1
      || (tokenHash && (callbackToken || fragment.has("refresh_token")))) throw new Error(invalidLinkMessage);
    // Never mistake a retained account session for a successful new callback.
    // The configured implicit flow supplies both tokens; PKCE codes are not used.
    if (!tokenHash && (!callbackToken || !fragment.get("refresh_token"))) throw new Error(invalidLinkMessage);
    const client = getAuthClient();
    if (!client) throw new Error("Вход пока недоступен. Попробуйте позже.");
    if (!tokenHash && !snapshot?.initializedWithCallback) throw new Error(invalidLinkMessage);
    const initialized = await client.auth.initialize();
    if (initialized.error) throw new Error(invalidLinkMessage);
    let session;
    if (tokenHash) {
      if (url.searchParams.get("type") !== "email") throw new Error(invalidLinkMessage);
      const result = await client.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
      if (result.error) throw new Error(invalidLinkMessage);
      session = result.data.session;
    } else {
      const result = await client.auth.getSession();
      if (result.error) throw new Error(invalidLinkMessage);
      session = result.data.session;
      if (!session || !callbackToken || !matchesCallbackSession(callbackToken, session.access_token, session.user.id)) {
        throw new Error(invalidLinkMessage);
      }
    }
    if (!session) throw new Error(invalidLinkMessage);
    // An earlier demo login must not reappear when this Supabase session ends.
    try {
      await clearDemoSession();
    } catch {
      await clearSupabaseSession();
      throw new Error("Не удалось завершить переключение аккаунта. Повторите вход.");
    }
    return session.user.id;
  } finally {
    clearAuthCallbackSnapshot();
    window.history.replaceState(null, "", "/auth/callback");
  }
}

function sessionClaims(token: string): { subject: string; sessionId: string } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const encoded = parts[1].replaceAll("-", "+").replaceAll("_", "/");
    const claims = JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "=")));
    if (typeof claims.sub !== "string" || !claims.sub || typeof claims.session_id !== "string" || !claims.session_id) return null;
    return { subject: claims.sub, sessionId: claims.session_id };
  } catch { return null; }
}

function matchesCallbackSession(callbackToken: string, currentToken: string, userId: string): boolean {
  if (currentToken === callbackToken) return true;
  // This runs only after successful SDK initialization with the captured URL:
  // the SDK has verified the callback token via getUser. A getSession call may
  // already have refreshed it, while preserving its subject and session_id.
  // These decoded fields correlate sessions; server API authorization still
  // verifies the current token with Supabase and never trusts decoded claims.
  const callback = sessionClaims(callbackToken);
  const current = sessionClaims(currentToken);
  return !!callback && !!current && callback.subject === userId && current.subject === userId
    && callback.sessionId === current.sessionId;
}

async function clearSupabaseSession(): Promise<void> {
  const client = getAuthClient();
  if (!client) return;
  let failure: unknown;
  try {
    const result = await client.auth.signOut({ scope: "local" });
    failure = result.error;
  } catch (cause) {
    failure = cause;
  }
  if (failure) {
    const current = await client.auth.getSession();
    if (current.error || current.data.session) throw failure;
  }
}

function announceAccountChange() {
  localStorage.setItem("businesscup26.auth-change", crypto.randomUUID());
}

async function clearDemoSession() {
  const response = await fetch("/api/auth/demo", { method: "DELETE", cache: "no-store" });
  if (!response.ok) throw new Error("Не удалось выйти из аккаунта. Повторите попытку.");
}

export async function loginWithPassword(username: string, password: string): Promise<void> {
  const response = await fetch("/api/auth/demo", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password }),
    cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message ?? "Не удалось войти. Повторите попытку.");
  try {
    // Otherwise an older Supabase bearer would still override the new demo cookie.
    await clearSupabaseSession();
  } catch {
    await clearDemoSession();
    throw new Error("Не удалось переключить аккаунт. Сначала выйдите из текущего аккаунта и повторите вход.");
  }
  clearHistoryLinkMarker();
  announceAccountChange();
  window.location.replace("/");
}

export async function signOutLocally(): Promise<void> {
  // Clear the HttpOnly cookie before SDK events can trigger navigation.
  await clearDemoSession();
  await clearSupabaseSession();
  clearHistoryLinkMarker();
  announceAccountChange();
  window.location.replace("/");
}
