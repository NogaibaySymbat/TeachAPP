import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  initialize: vi.fn(),
  verifyOtp: vi.fn(),
  signInWithOAuth: vi.fn(),
  signOut: vi.fn(),
  getAuthClient: vi.fn(),
  getAuthCallbackSnapshot: vi.fn(),
  clearAuthCallbackSnapshot: vi.fn(),
  getAnonymousId: vi.fn(),
  resetAnonymousId: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  getAuthClient: mocks.getAuthClient,
  getAuthCallbackSnapshot: mocks.getAuthCallbackSnapshot,
  clearAuthCallbackSnapshot: mocks.clearAuthCallbackSnapshot,
}));
vi.mock("@/lib/anon-id", () => ({ getAnonymousId: mocks.getAnonymousId, resetAnonymousId: mocks.resetAnonymousId }));

import { clearHistoryLinkMarker, linkGuestHistory, loginWithGoogle, loginWithPassword, signOutLocally, verifySignInLink } from "../src/lib/auth-flow";

const marker = "businesscup26.account-history";
const accountSession = (id = "account-a", token = "token-a") => ({ data: { session: { user: { id }, access_token: token } }, error: null });
let guestId: string;
let storage: Map<string, string>;
let fetchMock: ReturnType<typeof vi.fn>;
let navigate: ReturnType<typeof vi.fn>;
let replaceState: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetAllMocks();
  guestId = "guest-original";
  storage = new Map();
  mocks.getAuthClient.mockReturnValue({ auth: mocks });
  mocks.getAuthCallbackSnapshot.mockImplementation(() => ({ href: window.location.href, initializedWithCallback: true }));
  mocks.getAnonymousId.mockImplementation(() => guestId);
  mocks.resetAnonymousId.mockImplementation(() => guestId = "guest-fresh");
  mocks.getSession.mockResolvedValue(accountSession());
  mocks.initialize.mockResolvedValue({ error: null });
  mocks.verifyOtp.mockResolvedValue(accountSession());
  mocks.signInWithOAuth.mockResolvedValue({ data: { provider: "google", url: "https://test.supabase.co/auth/v1/authorize?provider=google" }, error: null });
  mocks.signOut.mockResolvedValue({ error: null });
  fetchMock = vi.fn().mockResolvedValue(Response.json({ claimed: true }));
  navigate = vi.fn();
  replaceState = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
  vi.stubGlobal("window", {
    location: { origin: "https://study.example", href: "https://study.example/auth/callback#access_token=token-a&refresh_token=refresh-a", replace: navigate },
    history: { replaceState },
    dispatchEvent: vi.fn(),
  });
});

afterEach(() => { vi.unstubAllGlobals(); });

describe("account history linking", () => {
  it("binds the request to the captured account token and guest despite an identity switch", async () => {
    mocks.getSession.mockImplementationOnce(async () => {
      guestId = "guest-new-browser-state";
      mocks.getSession.mockResolvedValue(accountSession("account-b", "token-b"));
      return accountSession();
    });

    await expect(linkGuestHistory("account-a")).rejects.toThrow("Аккаунт изменился");

    expect(fetchMock).toHaveBeenCalledWith("/api/auth/claim", {
      method: "POST",
      headers: { authorization: "Bearer token-a", "x-anonymous-id": "guest-original" },
      cache: "no-store",
    });
    expect(mocks.resetAnonymousId).not.toHaveBeenCalled();
    expect(storage.has(marker)).toBe(false);
  });

  it("deduplicates concurrent claims and does not rotate a consumed guest on another mount", async () => {
    const first = linkGuestHistory("account-a");
    expect(linkGuestHistory("account-a")).toBe(first);
    await expect(first).resolves.toBe("linked");
    await expect(linkGuestHistory("account-a")).resolves.toBe("already-linked");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mocks.resetAnonymousId).toHaveBeenCalledTimes(1);
    expect(storage.get(marker)).toBe("account-a:guest-fresh");
  });

  it("does not rotate a guest another tab already retired while the claim was pending", async () => {
    fetchMock.mockImplementationOnce(async () => {
      guestId = "guest-from-other-tab";
      storage.set(marker, "account-a:guest-from-other-tab");
      return Response.json({ claimed: true });
    });
    await expect(linkGuestHistory("account-a")).resolves.toBe("linked");
    expect(mocks.resetAnonymousId).not.toHaveBeenCalled();
    expect(storage.get(marker)).toBe("account-a:guest-from-other-tab");
  });

  it("preserves guest history and structured errors when the claim fails", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ error: { code: "DATABASE_UNAVAILABLE", message: "Try again later" } }, { status: 503 }));
    await expect(linkGuestHistory("account-a")).rejects.toMatchObject({ code: "DATABASE_UNAVAILABLE", status: 503 });
    expect(guestId).toBe("guest-original");
    expect(mocks.resetAnonymousId).not.toHaveBeenCalled();
    expect(storage.has(marker)).toBe(false);
  });

  it("separates another account's guest history without reporting an import", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ error: { code: "GUEST_HISTORY_UNAVAILABLE", message: "Already claimed" } }, { status: 409 }));
    await expect(linkGuestHistory("account-a")).resolves.toBe("other-account");
    expect(mocks.resetAnonymousId).toHaveBeenCalledTimes(1);
  });
});

describe("Google sign-in", () => {
  it("uses the Google provider, this origin's callback and the account chooser", async () => {
    await expect(loginWithGoogle()).resolves.toBeUndefined();
    expect(mocks.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: "https://study.example/auth/callback", queryParams: { prompt: "select_account" } },
    });
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("explains missing configuration without pretending to redirect", async () => {
    mocks.getAuthClient.mockReturnValue(null);
    await expect(loginWithGoogle()).rejects.toThrow("Вход через Google пока не настроен");
    expect(mocks.signInWithOAuth).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("shows a Russian error when the SDK refuses to start OAuth", async () => {
    mocks.signInWithOAuth.mockResolvedValueOnce({ data: { url: null }, error: new Error("Provider disabled") });
    await expect(loginWithGoogle()).rejects.toThrow("Не удалось открыть вход через Google");
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("rejects a missing redirect URL or a transport failure", async () => {
    mocks.signInWithOAuth.mockResolvedValueOnce({ data: { url: null }, error: null });
    await expect(loginWithGoogle()).rejects.toThrow("Не удалось открыть вход через Google");
    mocks.signInWithOAuth.mockRejectedValueOnce(new Error("Network unavailable"));
    await expect(loginWithGoogle()).rejects.toThrow("Не удалось открыть вход через Google");
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe("email and OAuth callback verification", () => {
  it("uses the captured callback after another component initializes the SDK and strips the fragment", async () => {
    const original = window.location.href;
    mocks.getAuthCallbackSnapshot.mockReturnValue({ href: original, initializedWithCallback: true });
    window.location.href = "https://study.example/auth/callback";
    await expect(verifySignInLink()).resolves.toBe("account-a");
    expect(mocks.clearAuthCallbackSnapshot).toHaveBeenCalledOnce();
  });

  it("clears the captured callback on verification failure", async () => {
    mocks.initialize.mockResolvedValueOnce({ error: new Error("Expired") });
    await expect(verifySignInLink()).rejects.toThrow("Не удалось подтвердить вход");
    expect(mocks.clearAuthCallbackSnapshot).toHaveBeenCalledOnce();
  });

  it("does not treat a client initialized on a different page as a successful implicit callback", async () => {
    mocks.getAuthCallbackSnapshot.mockReturnValue({ href: window.location.href, initializedWithCallback: false });
    await expect(verifySignInLink()).rejects.toThrow("Не удалось подтвердить вход");
    expect(mocks.getSession).not.toHaveBeenCalled();
  });

  it("accepts a refreshed token only for the same verified callback subject and session", async () => {
    const jwt = (subject: string, sessionId: string, version: number) => `header.${Buffer.from(JSON.stringify({ sub: subject, session_id: sessionId, iat: version })).toString("base64url")}.signature`;
    const initial = jwt("account-a", "session-one", 1);
    window.location.href = `https://study.example/auth/callback#access_token=${initial}&refresh_token=refresh-a`;
    mocks.getSession.mockResolvedValueOnce(accountSession("account-a", jwt("account-a", "session-one", 2)));
    await expect(verifySignInLink()).resolves.toBe("account-a");
    mocks.getSession.mockResolvedValueOnce(accountSession("account-a", jwt("account-a", "older-session", 2)));
    await expect(verifySignInLink()).rejects.toThrow("Не удалось подтвердить вход");
    mocks.getSession.mockResolvedValueOnce(accountSession("account-b", jwt("account-b", "session-one", 2)));
    await expect(verifySignInLink()).rejects.toThrow("Не удалось подтвердить вход");
  });

  it("rejects an expired implicit link even when an older account session remains", async () => {
    mocks.initialize.mockResolvedValueOnce({ error: new Error("Expired link") });
    await expect(verifySignInLink()).rejects.toThrow("Не удалось подтвердить вход");
    expect(mocks.getSession).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(replaceState).toHaveBeenCalledWith(null, "", "/auth/callback");
  });

  it.each([
    "?error=access_denied",
    "?error_code=otp_expired",
    "?error_description=Expired",
    "#error=access_denied",
    "#error_code=otp_expired",
    "#error_description=Expired",
  ])("rejects callback error fields before trusting an existing session: %s", async (suffix) => {
    window.location.href = `https://study.example/auth/callback${suffix}`;
    await expect(verifySignInLink()).rejects.toThrow("Не удалось подтвердить вход");
    expect(mocks.getSession).not.toHaveBeenCalled();
    expect(replaceState).toHaveBeenCalledWith(null, "", "/auth/callback");
  });

  it("rejects a cancelled Google callback while preserving an older account session", async () => {
    window.location.href = "https://study.example/auth/callback#error=access_denied&error_description=User+cancelled+Google+sign-in";
    await expect(verifySignInLink()).rejects.toThrow("Не удалось подтвердить вход");
    expect(mocks.initialize).not.toHaveBeenCalled();
    expect(mocks.getSession).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["", "?code=unsupported-pkce-code", "#access_token=token-a", "#refresh_token=refresh-a"])("rejects missing implicit credentials instead of reusing an old session: %s", async (suffix) => {
    window.location.href = `https://study.example/auth/callback${suffix}`;
    await expect(verifySignInLink()).rejects.toThrow("Не удалось подтвердить вход");
    expect(mocks.getSession).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    "?access_token=query-token#access_token=token-a&refresh_token=refresh-a",
    "#access_token=token-a&access_token=another-token&refresh_token=refresh-a",
    "#access_token=token-a&refresh_token=refresh-a&refresh_token=another-refresh",
    "?token_hash=email-token&type=email#access_token=token-a&refresh_token=refresh-a",
  ])("rejects ambiguous callback credentials: %s", async (suffix) => {
    window.location.href = `https://study.example/auth/callback${suffix}`;
    await expect(verifySignInLink()).rejects.toThrow("Не удалось подтвердить вход");
    expect(mocks.initialize).not.toHaveBeenCalled();
    expect(mocks.getSession).not.toHaveBeenCalled();
  });

  it("rejects a retained session that does not match the callback token", async () => {
    mocks.getSession.mockResolvedValueOnce(accountSession("old-account", "old-token"));
    await expect(verifySignInLink()).rejects.toThrow("Не удалось подтвердить вход");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps supporting token-hash email links", async () => {
    window.location.href = "https://study.example/auth/callback?token_hash=email-token&type=email";
    await expect(verifySignInLink()).resolves.toBe("account-a");
    expect(mocks.verifyOtp).toHaveBeenCalledWith({ token_hash: "email-token", type: "email" });
    expect(mocks.getSession).not.toHaveBeenCalled();
  });

  it("awaits successful initialization before accepting the callback session", async () => {
    let initializeComplete = false;
    mocks.initialize.mockImplementationOnce(async () => { initializeComplete = true; return { error: null }; });
    mocks.getSession.mockImplementationOnce(async () => {
      expect(initializeComplete).toBe(true);
      return accountSession();
    });
    await expect(verifySignInLink()).resolves.toBe("account-a");
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/demo", { method: "DELETE", cache: "no-store" });
    expect(replaceState).toHaveBeenCalledWith(null, "", "/auth/callback");
  });

  it("rolls back the new email session if an old demo cookie cannot be cleared", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ error: {} }, { status: 503 }));
    await expect(verifySignInLink()).rejects.toThrow("Не удалось завершить");
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(navigate).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("password sign-in and provider switching", () => {
  it("ends an older email session before entering the demo and preserves private guest history", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ account: { id: "demo", provider: "demo" } }));
    mocks.signOut.mockImplementationOnce(async () => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(navigate).not.toHaveBeenCalled();
      return { error: null };
    });
    await loginWithPassword("admin", "admin");
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/demo", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "admin" }), cache: "no-store",
    });
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(guestId).toBe("guest-original");
    expect(mocks.resetAnonymousId).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith("/");
    expect(storage.has("businesscup26.auth-change")).toBe(true);
  });

  it("leaves the existing account untouched after incorrect credentials", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ error: { message: "Неверный логин или пароль." } }, { status: 401 }));
    await expect(loginWithPassword("admin", "wrong")).rejects.toThrow("Неверный логин");
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("rolls back the demo cookie if the older email session cannot be cleared", async () => {
    mocks.signOut.mockResolvedValueOnce({ error: new Error("Still signed in") });
    await expect(loginWithPassword("admin", "admin")).rejects.toThrow("Не удалось переключить");
    expect(fetchMock.mock.calls.map(([, init]) => init.method)).toEqual(["POST", "DELETE"]);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("clears the cookie before SDK sign-out events can navigate away", async () => {
    mocks.signOut.mockImplementationOnce(async () => {
      expect(fetchMock).toHaveBeenCalledWith("/api/auth/demo", { method: "DELETE", cache: "no-store" });
      return { error: null };
    });
    await signOutLocally();
    expect(navigate).toHaveBeenCalledWith("/");
  });

  it("does not report logout if the cookie could not be removed", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ error: {} }, { status: 503 }));
    await expect(signOutLocally()).rejects.toThrow("Не удалось выйти");
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe("local sign-out", () => {
  it("clears the marker after actual local logout even when remote revocation fails", async () => {
    storage.set(marker, "account-a:guest-original");
    mocks.signOut.mockImplementationOnce(async () => {
      clearHistoryLinkMarker(); // The synchronous SIGNED_OUT subscriber.
      expect(storage.has(marker)).toBe(false);
      return { error: new Error("Remote revocation failed") };
    });
    mocks.getSession.mockResolvedValueOnce({ data: { session: null }, error: null });
    await expect(signOutLocally()).resolves.toBeUndefined();
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(storage.has(marker)).toBe(false);
    expect(guestId).toBe("guest-original");
    expect(navigate).toHaveBeenCalledWith("/");
  });

  it("does not report logout when the failed request leaves an account signed in", async () => {
    storage.set(marker, "account-a:guest-original");
    mocks.signOut.mockResolvedValueOnce({ error: new Error("Sign-out failed") });
    await expect(signOutLocally()).rejects.toThrow("Sign-out failed");
    expect(navigate).not.toHaveBeenCalled();
    expect(storage.has(marker)).toBe(true);
  });
});
