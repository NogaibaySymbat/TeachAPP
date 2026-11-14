import { describe, expect, it } from "vitest";
import { compareAttempts } from "../src/lib/attempt-comparison";
import { sessionExportText } from "../src/lib/session-export";
import type { SavedExamAttempt, SessionExport } from "../src/lib/types";

function attempt(id: string, correct: boolean[]): SavedExamAttempt {
  return { id, createdAt: "2026-11-15T00:00:00Z", revision: id, score: correct.filter(Boolean).length, total: correct.length,
    notebookSnapshot: [{ id: `note-${id}`, claim: "First idea.", sourceMessageId: "message-1" }], gaps: [],
    results: correct.map((value, index) => ({ questionId: `q-${index}`, questionText: `Question ${index}`, options: [{ id: "a", text: "Yes" }, { id: "b", text: "No" }],
      correctAnswer: "a", answer: value ? "a" : "b", correct: value, guessed: false, reasoning: "A saved reason.", notebookRefs: [`note-${id}`] })),
  };
}

describe("saved attempt comparison", () => {
  it("shows both gained and lost correct answers instead of hiding regression behind an unchanged score", () => {
    const result = compareAttempts(attempt("before", [true, false]), attempt("after", [false, true]));
    expect(result).toMatchObject({ comparable: true, delta: 0 });
    expect(result.improved.map((q) => q.questionId)).toEqual(["q-1"]);
    expect(result.regressed.map((q) => q.questionId)).toEqual(["q-0"]);
  });
  it("reports a negative score change without claiming improvement", () => {
    expect(compareAttempts(attempt("before", [true, true]), attempt("after", [false, false])).delta).toBe(-2);
  });
  it("does not count regenerated notebook IDs as new learning", () => {
    expect(compareAttempts(attempt("before", [false]), attempt("after", [true])).addedNotes).toEqual([]);
  });
  it("links only newly added evidence cited by newly correct answers", () => {
    const before = attempt("before", [false]);
    const after = attempt("after", [true]);
    after.notebookSnapshot.push({ id: "new", claim: "A new idea.", sourceMessageId: "message-2" }, { id: "unused", claim: "Another idea.", sourceMessageId: "message-3" });
    after.results[0].notebookRefs.push("new");
    const result = compareAttempts(before, after);
    expect(result.delta).toBe(1);
    expect(result.addedNotes).toHaveLength(2);
    expect(result.newlyCitedNotes.map((note) => note.id)).toEqual(["new"]);
  });
  it.each(["questionText", "correctAnswer"] as const)("rejects changed %s even when the question IDs match", (field) => {
    const after = attempt("after", [true]);
    after.results[0][field] = "Changed";
    expect(compareAttempts(attempt("before", [false]), after)).toMatchObject({ comparable: false, delta: null, improved: [], regressed: [] });
  });
  it("rejects different options, totals, and duplicate attempts", () => {
    const before = attempt("before", [false]);
    const after = attempt("after", [true]);
    after.results[0].options[0].text = "Different meaning";
    expect(compareAttempts(before, after).comparable).toBe(false);
    expect(compareAttempts(before, attempt("other", [true, true])).comparable).toBe(false);
    expect(compareAttempts(before, before).comparable).toBe(false);
  });
  it("matches questions by identity when their order changes", () => {
    const after = attempt("after", [true, true]);
    after.results.reverse();
    expect(compareAttempts(attempt("before", [false, true]), after)).toMatchObject({ comparable: true, delta: 1 });
  });
});

describe("readable session export", () => {
  const empty: SessionExport = { formatVersion: 1, exportedAt: "2026-11-15T00:00:00Z", topic: { id: "demo", title: "Topic", description: "Practice only." },
    session: { id: "session", topicId: "demo", startedAt: "2026-11-14T00:00:00Z", finishedAt: null },
    messages: [], notebook: [], notebookFresh: false, attempts: [], legacyAttempts: [],
  };
  it("handles sessions with no messages or attempts and marks stale notes", () => {
    const text = sessionExportText(empty);
    expect(text).toContain("No saved messages.");
    expect(text).toContain("No saved exam attempts.");
    expect(text).toContain("Not up to date");
  });
  it("keeps all attempts and their original evidence when current notes change, preserving Unicode", () => {
    const first = attempt("before", [false]);
    const second = attempt("after", [true]);
    const data = { ...empty, messages: [{ id: "message-1", role: "user" as const, text: "Объяснение <script>test</script>", createdAt: empty.exportedAt }],
      notebook: [{ id: "current", claim: "Replacement note.", sourceMessageId: "message-1" }], attempts: [first, second] };
    const text = sessionExportText(data);
    expect(text.indexOf("Attempt 1: 0/1")).toBeLessThan(text.indexOf("Attempt 2: 1/1"));
    expect(text).toContain("Cited note: First idea.");
    expect(text).toContain("Replacement note.");
    expect(text).toContain("Conversation message [1]");
    expect(text).toContain(data.messages[0].text);
    expect(text).toContain("Correct answer: a");
  });
  it("hides correct options for failed questions until the topic is passed", () => {
    const failedOnly = sessionExportText({ ...empty, attempts: [attempt("before", [false])] });
    expect(failedOnly).toContain("Correct answer: hidden until the topic is passed");
    expect(failedOnly).not.toContain("Correct answer: a");
  });
});
