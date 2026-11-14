"use client";

const storageKey = "businesscup26.anonymous-id";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function getAnonymousId(): string {
  const existing = localStorage.getItem(storageKey);
  if (existing && uuidPattern.test(existing)) return existing;
  return resetAnonymousId();
}

export function resetAnonymousId(): string {
  const id = crypto.randomUUID();
  localStorage.setItem(storageKey, id);
  return id;
}
