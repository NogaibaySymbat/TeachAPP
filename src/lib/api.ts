"use client";

import { getAnonymousId, resetAnonymousId } from "./anon-id";
import { getAuthClient } from "./auth-client";

export class ApiRequestError extends Error {
  constructor(message: string, public code: string, public status: number) {
    super(message);
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("x-anonymous-id", getAnonymousId());
  const auth = getAuthClient();
  if (auth) {
    const { data, error } = await auth.auth.getSession();
    if (error) throw new ApiRequestError("Your sign-in could not be restored. Please sign in again.", "AUTH_REQUIRED", 401);
    if (data.session) headers.set("authorization", `Bearer ${data.session.access_token}`);
  }
  if (init?.body) headers.set("content-type", "application/json");
  let response = await fetch(path, { ...init, headers, cache: "no-store" });
  let data = await response.json();
  if (response.status === 401 && data.error?.code === "SIGN_IN_REQUIRED" && !headers.has("authorization")) {
    // A previous sign-in may have consumed this guest ID before its browser
    // received the response. A retired guest ID can never recover account data.
    const currentId = getAnonymousId();
    const guestId = currentId === headers.get("x-anonymous-id") ? resetAnonymousId() : currentId;
    headers.set("x-anonymous-id", guestId);
    response = await fetch(path, { ...init, headers, cache: "no-store" });
    data = await response.json();
  }
  if (!response.ok) throw new ApiRequestError(
    data.error?.message ?? "The request failed. Please try again.",
    data.error?.code ?? "REQUEST_FAILED",
    response.status,
  );
  return data as T;
}
