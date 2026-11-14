"use client";

import { getAnonymousId, resetAnonymousId } from "./anon-id";

export class ApiRequestError extends Error {
  constructor(message: string, public code: string, public status: number) {
    super(message);
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("x-anonymous-id", getAnonymousId());
  // Browser history uses its own random ID. Old shared-demo cookies or
  // Supabase sessions must never select another visitor's account here.
  headers.delete("authorization");
  if (init?.body) headers.set("content-type", "application/json");
  let response = await fetch(path, { ...init, headers, cache: "no-store", credentials: "omit" });
  let data = await response.json();
  if (response.status === 401 && data.error?.code === "SIGN_IN_REQUIRED" && !headers.has("authorization")) {
    // A previous sign-in may have consumed this guest ID before its browser
    // received the response. A retired guest ID can never recover account data.
    const currentId = getAnonymousId();
    const guestId = currentId === headers.get("x-anonymous-id") ? resetAnonymousId() : currentId;
    headers.set("x-anonymous-id", guestId);
    response = await fetch(path, { ...init, headers, cache: "no-store", credentials: "omit" });
    data = await response.json();
  }
  if (!response.ok) throw new ApiRequestError(
    data.error?.message ?? "The request failed. Please try again.",
    data.error?.code ?? "REQUEST_FAILED",
    response.status,
  );
  return data as T;
}
