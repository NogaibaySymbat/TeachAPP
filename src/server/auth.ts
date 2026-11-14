import "server-only";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { anonymousId } from "./http";
import { ServiceError } from "./errors";
import { findDemoAccount, getOrCreateAccount, resolveGuestId } from "./repositories/accounts";
import { hasDemoCookie, readDemoAccountId } from "./demo-auth";

export type AuthAccount =
  | { id: string; label: string; provider: "demo" }
  | { id: string; label: string; provider: "supabase"; subject: string };

export async function currentAccount(request: Request): Promise<AuthAccount | null> {
  // An explicit bearer token always wins; a bad token must not fall back to a cookie.
  if (!request.headers.has("authorization")) {
    const id = readDemoAccountId(request);
    if (!id) return null;
    if (!await findDemoAccount(id)) throw new ServiceError(401, "AUTH_REQUIRED", "Please sign in again.");
    return { id, label: "admin", provider: "demo" };
  }
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer ([^\s]+)$/i);
  if (!match || match[1].length > 8192) {
    throw new ServiceError(401, "AUTH_REQUIRED", "Please sign in to your account.");
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new ServiceError(503, "AUTH_UNAVAILABLE", "Sign-in is temporarily unavailable. Please try again later.");
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10000) }),
    },
  });
  const { data, error } = await supabase.auth.getUser(match[1]);
  if (error) {
    if (!error.status || error.status === 429 || error.status >= 500) {
      throw new ServiceError(503, "AUTH_UNAVAILABLE", "Sign-in could not be checked. Please try again.");
    }
    throw new ServiceError(401, "AUTH_REQUIRED", "Your sign-in has expired. Please sign in again.");
  }
  const user = data.user;
  if (!user || user.is_anonymous || !user.email_confirmed_at || !z.uuid().safeParse(user.id).success) {
    throw new ServiceError(401, "AUTH_REQUIRED", "Please confirm your email to sign in.");
  }
  return { id: await getOrCreateAccount(user.id), label: user.email ?? "Your account", provider: "supabase", subject: user.id };
}

export async function requireAccount(request: Request): Promise<string> {
  const account = await currentAccount(request);
  if (!account) throw new ServiceError(401, "AUTH_REQUIRED", "Please sign in to see this history.");
  return account.id;
}

export async function requestIdentity(request: Request): Promise<string> {
  if (request.headers.has("authorization") || hasDemoCookie(request)) return requireAccount(request);
  return resolveGuestId(anonymousId(request));
}
