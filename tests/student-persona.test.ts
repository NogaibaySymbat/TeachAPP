import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StudentPersona } from "../src/components/student-persona";
import { getStudentPersona } from "../src/lib/student-persona";
import type { SessionResponse } from "../src/lib/types";

const empty: SessionResponse = {
  session: { id: "s1", topicId: "risks", startedAt: "2026-11-15T00:00:00Z", finishedAt: null },
  topic: { id: "risks", title: "Risks", description: "Practice" },
  messages: [], notebook: [], latestAttempt: null, previousAttempt: null,
  learning: { revision: "r1", notebookRevision: "r1", notebookFresh: true, questionCount: 3 },
  ai: { available: true, message: null },
};
const notes = ["Assess likelihood.", "Assess impact.", "Review risks regularly."].map((claim, index) => ({ id: `n${index}`, sourceMessageId: "m1", claim }));
const learned = { ...empty, notebook: notes };
const passed = { ...learned, latestAttempt: { id: "a1", revision: "r1", score: 3, total: 3, createdAt: "2026-11-15T00:00:00Z", results: [], notebookSnapshot: notes, gaps: [] } };

describe("Milo's expressions follow saved progress", () => {
  it("stays neutral when conversation messages have not produced any saved notes", () => {
    const data = { ...empty, messages: [{ id: "m1", role: "user" as const, text: "Hello!", createdAt: "2026-11-15T00:00:00Z" }] };
    expect(getStudentPersona(data).expression).toBe("neutral");
    expect(getStudentPersona(data).status).toContain("notebook is empty");
  });
  it("smiles progressively as distinct notes arrive, without claiming the topic is understood", () => {
    expect([0, 1, 2, 3].map((count) => getStudentPersona({ ...empty, notebook: notes.slice(0, count) }).expression))
      .toEqual(["neutral", "curious", "learning", "engaged"]);
    expect(getStudentPersona(learned).status).toBe("I have 3 notes to try in the exam.");
  });
  it("does not reward duplicate quotes, blank notes, or regenerated IDs", () => {
    const repeated = { ...empty, notebook: [notes[0], { ...notes[0], id: "new-id", claim: ` ${notes[0].claim} ` }, { ...notes[0], id: "blank", claim: "  " }] };
    expect(getStudentPersona(repeated).expression).toBe("curious");
    expect(getStudentPersona({ ...learned, notebook: notes.map((note) => ({ ...note, id: `new-${note.id}` })) })).toEqual(getStudentPersona(learned));
  });
  it("celebrates only a passed, current, nonempty exam", () => {
    expect(getStudentPersona(passed).expression).toBe("celebrating");
    for (const latestAttempt of [
      { ...passed.latestAttempt, revision: "old" },
      { ...passed.latestAttempt, score: 1 },
      { ...passed.latestAttempt, score: 0, total: 0 },
    ]) expect(getStudentPersona({ ...learned, latestAttempt }).expression).toBe("engaged");
    expect(getStudentPersona({ ...passed, learning: { ...passed.learning, notebookFresh: false } }).expression).toBe("engaged");
  });
  it("keeps saved progress when the API is paused, and describes the pause truthfully", () => {
    const state = getStudentPersona({ ...learned, ai: { available: false, message: "Paused" } });
    expect(state.expression).toBe("engaged");
    expect(state.activity).toBe("paused");
    expect(state.status).toBe("Replies paused · 3 saved notes");
  });
  it("shows real pending work without advancing the saved-note expression", () => {
    expect(getStudentPersona(empty, { replying: true, writing: true })).toMatchObject({ expression: "neutral", activity: "writing" });
    expect(getStudentPersona(learned, { replying: true })).toMatchObject({ expression: "engaged", activity: "thinking" });
    expect(getStudentPersona(learned, { examining: true, writing: true }).activity).toBe("exam");
    expect(getStudentPersona(learned, { listening: true, replying: true }).activity).toBe("listening");
  });
  it("keeps the AI label and a text status accessible without reading SVG paths", () => {
    const html = renderToStaticMarkup(createElement(StudentPersona, { state: getStudentPersona(empty) }));
    expect(html).toContain("AI student");
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("My notebook is empty. Teach me one idea.");
  });
  it("waits until the walkthrough ends to reveal a passed exam in the face and status", () => {
    const state = getStudentPersona(passed, { reviewing: true });
    expect(state.expression).toBe("engaged");
    expect(state.activity).toBe("review");
    expect(state.status).toBe("The exam is saved. Let’s review each answer.");
    expect(getStudentPersona(passed).expression).toBe("celebrating");
  });
});
