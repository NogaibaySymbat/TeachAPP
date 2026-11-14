// Anonymous user id stored in the browser. No sign-in in the MVP.
const KEY = "anon_user_id";

export function getAnonId(): string {
  if (typeof window === "undefined") {
    throw new Error("getAnonId must be called in the browser");
  }
  try {
    const existing = window.localStorage.getItem(KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    window.localStorage.setItem(KEY, id);
    return id;
  } catch {
    // Storage unavailable: fall back to a per-tab id.
    return crypto.randomUUID();
  }
}
