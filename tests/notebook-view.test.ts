import { describe, expect, it } from "vitest";
import { compareNotebookUpdate, currentNotebookUpdate, latestStudentExchange, notebookEntryKey } from "../src/lib/notebook-view";
import type { LearningState, Message, NotebookEntry } from "../src/lib/types";

const note = (id: string, claim = "Teach one idea.", sourceMessageId = "m1"): NotebookEntry => ({ id, claim, sourceMessageId });
const message = (id: string, role: Message["role"], replyToMessageId?: string): Message => ({ id, role, text: id, createdAt: "2026-11-15T00:00:00Z", replyToMessageId });
const fresh: LearningState = { revision: "r2", notebookRevision: "r2", notebookFresh: true, questionCount: 3 };

describe("visible notebook changes", () => {
  it("does not present regenerated database IDs or reordered notes as new knowledge", () => {
    expect(compareNotebookUpdate([note("1"), note("2", "Second idea.")], [note("new2", "Second idea."), note("new1")], "r2"))
      .toEqual({ revision: "r2", addedKeys: [], removedCount: 0 });
  });
  it("keeps the source in note identity, and reports both additions and removals", () => {
    const next = note("2", "Teach one idea.", "m2");
    const update = compareNotebookUpdate([note("1")], [next], "r2");
    expect(update.addedKeys).toEqual([notebookEntryKey(next)]);
    expect(update.removedCount).toBe(1);
    expect(compareNotebookUpdate([note("1")], [note("2", "Corrected idea.")], "r2").removedCount).toBe(1);
  });
  it("handles an empty result without inventing additions", () => {
    expect(compareNotebookUpdate([note("1")], [], "r2")).toMatchObject({ addedKeys: [], removedCount: 1 });
    expect(compareNotebookUpdate([], [], "r2")).toMatchObject({ addedKeys: [], removedCount: 0 });
  });
  it("never highlights notes from a stale revision or after a reload with no recorded update", () => {
    const update = compareNotebookUpdate([], [note("1")], "r2");
    expect(currentNotebookUpdate(update, fresh)).toBe(update);
    expect(currentNotebookUpdate(null, fresh)).toBeNull();
    expect(currentNotebookUpdate(update, { ...fresh, notebookFresh: false })).toBeNull();
    expect(currentNotebookUpdate(update, { ...fresh, revision: "r3" })).toBeNull();
    expect(currentNotebookUpdate(update, { ...fresh, notebookRevision: "r1" })).toBeNull();
  });
});

describe("student interpretation of the latest explanation", () => {
  it("does not show the earlier reply as understanding of a new explanation", () => {
    const messages = [message("m1", "user"), message("s1", "student", "m1"), message("m2", "user")];
    expect(latestStudentExchange(messages)).toMatchObject({ explanation: { id: "m2" }, reply: undefined, number: 2 });
    messages.push(message("s2", "student", "m2"));
    expect(latestStudentExchange(messages)?.reply?.id).toBe("s2");
  });
  it("ignores a late reply to a different explanation", () => {
    expect(latestStudentExchange([message("m1", "user"), message("m2", "user"), message("s1", "student", "m1")])?.reply).toBeUndefined();
  });
  it("supports old unlinked replies only after the latest user explanation", () => {
    const messages = [message("m1", "user"), message("s1", "student"), message("m2", "user")];
    expect(latestStudentExchange(messages)?.reply).toBeUndefined();
    messages.push(message("s2", "student"));
    expect(latestStudentExchange(messages)?.reply?.id).toBe("s2");
    expect(latestStudentExchange([])).toBeNull();
  });
});
