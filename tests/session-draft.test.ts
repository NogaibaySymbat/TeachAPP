import { describe, expect, it, vi } from "vitest";
import { createSessionDraft, MAX_DRAFT_LENGTH } from "../src/lib/session-draft";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { values.set(key, value); }),
    removeItem: vi.fn((key: string) => { values.delete(key); }),
  };
}

describe("session draft persistence", () => {
  it("restores exact text after remount without writing during initialization", () => {
    const storage = memoryStorage();
    const original = createSessionDraft("session-a", storage);
    const words = "  My explanation\nПример 📝 <b>not HTML</b>  ";
    original.setText(words);
    storage.setItem.mockClear();
    const reopened = createSessionDraft("session-a", storage);
    expect(reopened.getSnapshot()).toEqual({ text: words, status: "restored" });
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(reopened.getServerSnapshot()).toEqual({ text: "", status: "empty" });
    expect(reopened.getServerSnapshot()).toBe(reopened.getServerSnapshot());
  });

  it("keeps separate sessions independent, including clearing a sent message", () => {
    const storage = memoryStorage();
    const first = createSessionDraft("a", storage);
    const second = createSessionDraft("b", storage);
    first.setText("First lesson");
    second.setText("Second lesson");
    first.setText("");
    expect(createSessionDraft("a", storage).getSnapshot().text).toBe("");
    expect(createSessionDraft("b", storage).getSnapshot().text).toBe("Second lesson");
    expect(storage.values.size).toBe(1);
  });

  it("keeps typing and appended dictation usable when storage throws", () => {
    const storage = memoryStorage();
    storage.setItem.mockImplementation(() => { throw new Error("Quota exceeded"); });
    const draft = createSessionDraft("a", storage);
    draft.setText("Typed words.");
    draft.setText((current) => `${current} Dictated words.`);
    expect(draft.getSnapshot()).toEqual({ text: "Typed words. Dictated words.", status: "unavailable" });
    storage.setItem.mockImplementation((key, value) => { storage.values.set(key, value); });
    draft.setText((current) => `${current} More.`);
    expect(draft.getSnapshot().status).toBe("saved");
    expect(createSessionDraft("a", storage).getSnapshot().text).toBe("Typed words. Dictated words. More.");
  });

  it("reports a failed clear instead of claiming the old stored draft is gone", () => {
    const storage = memoryStorage();
    const draft = createSessionDraft("a", storage);
    draft.setText("Already submitted.");
    storage.removeItem.mockImplementation(() => { throw new Error("Storage blocked"); });
    draft.setText("");
    expect(draft.getSnapshot()).toEqual({ text: "", status: "unavailable" });
  });

  it("ignores corrupt or oversized persisted data without deleting it", () => {
    for (const invalid of ["{", "null", '{"text":42}', JSON.stringify({ text: "a".repeat(MAX_DRAFT_LENGTH + 1) })]) {
      const storage = memoryStorage();
      storage.values.set("teachapp:draft:v1:a", invalid);
      expect(createSessionDraft("a", storage).getSnapshot()).toEqual({ text: "", status: "unavailable" });
      expect(storage.removeItem).not.toHaveBeenCalled();
    }
  });

  it("notifies subscribers and supports a browser without draft storage", () => {
    const draft = createSessionDraft("a", null);
    const listener = vi.fn();
    const unsubscribe = draft.subscribe(listener);
    draft.setText("Still editable");
    expect(listener).toHaveBeenCalledOnce();
    expect(draft.getSnapshot()).toEqual({ text: "Still editable", status: "unavailable" });
    unsubscribe();
    draft.setText("Continue typing");
    expect(listener).toHaveBeenCalledOnce();
  });
});
