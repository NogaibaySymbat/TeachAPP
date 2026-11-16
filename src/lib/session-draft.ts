type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type DraftStatus = "empty" | "restored" | "saved" | "unavailable";
export interface DraftSnapshot { text: string; status: DraftStatus }

const EMPTY_DRAFT: DraftSnapshot = { text: "", status: "empty" };
export const MAX_DRAFT_LENGTH = 4000;

function browserStorage(): DraftStorage | null {
  try { return typeof window === "undefined" ? null : window.localStorage; }
  catch { return null; }
}

/** One store per mounted conversation. Reading never overwrites another tab's draft. */
export function createSessionDraft(sessionId: string, storage: DraftStorage | null = browserStorage()) {
  const key = `teachapp:draft:v1:${sessionId}`;
  let snapshot: DraftSnapshot = EMPTY_DRAFT;
  const listeners = new Set<() => void>();
  try {
    const raw = storage?.getItem(key);
    if (raw) {
      const value: unknown = JSON.parse(raw);
      if (typeof value !== "object" || value === null || !("text" in value)
        || typeof value.text !== "string" || value.text.length > MAX_DRAFT_LENGTH) throw new Error("Invalid draft");
      snapshot = value.text ? { text: value.text, status: "restored" } : EMPTY_DRAFT;
    }
  } catch { snapshot = { text: "", status: "unavailable" }; }

  return {
    getSnapshot: () => snapshot,
    // A stable, empty server snapshot keeps hydration independent of browser storage.
    getServerSnapshot: () => EMPTY_DRAFT,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    setText(update: string | ((current: string) => string)) {
      const text = typeof update === "function" ? update(snapshot.text) : update;
      let status: DraftStatus = text ? "saved" : "empty";
      try {
        if (!storage || text.length > MAX_DRAFT_LENGTH) throw new Error("Draft storage unavailable");
        if (text) storage.setItem(key, JSON.stringify({ text }));
        else storage.removeItem(key);
      } catch { status = "unavailable"; }
      // Storage failure must never prevent typing or sending the in-memory message.
      snapshot = { text, status };
      listeners.forEach((listener) => listener());
    },
  };
}
