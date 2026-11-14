"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | undefined;
interface CallbackSnapshot { href: string; initializedWithCallback: boolean }
let callbackSnapshot: CallbackSnapshot | null = null;

export function getAuthCallbackSnapshot(): CallbackSnapshot | null {
  if (typeof window === "undefined" || new URL(window.location.href).pathname !== "/auth/callback") return null;
  callbackSnapshot ??= { href: window.location.href, initializedWithCallback: false };
  return callbackSnapshot;
}

export function clearAuthCallbackSnapshot(): void {
  callbackSnapshot = null;
}

export function getAuthClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;

  const snapshot = getAuthCallbackSnapshot();
  if (!browserClient) {
    // The SDK initializes during construction and clears the URL fragment after
    // validating it. Keep the original callback in memory for later hydration.
    if (snapshot) snapshot.initializedWithCallback = true;
    browserClient = createClient(url, key, {
      auth: {
        flowType: "implicit",
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "businesscup26.auth",
      },
    });
  }
  return browserClient;
}
