import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LearningPanel } from "../src/components/learning-panel";
import { compareNotebookUpdate } from "../src/lib/notebook-view";
import type { SessionResponse } from "../src/lib/types";

const explanation = { id: "m1", role: "user" as const, text: "Assess likelihood.", createdAt: "2026-11-15T00:00:00Z" };
const note = { id: "n1", claim: explanation.text, sourceMessageId: explanation.id };
const data: SessionResponse = {
  session: { id: "session", topicId: "risks", startedAt: explanation.createdAt, finishedAt: null },
  topic: { id: "risks", title: "Risks", description: "Practice" },
  messages: [explanation], notebook: [note],
  learning: { revision: "r1", notebookRevision: "r1", notebookFresh: true, questionCount: 3 },
  latestAttempt: null, previousAttempt: null, ai: { available: true, message: null },
};
function render(session: SessionResponse, props: Partial<ComponentProps<typeof LearningPanel>> = {}) {
  return renderToStaticMarkup(createElement(LearningPanel, { data: session, disabled: false, updating: false,
    replying: false, replyError: "", update: null, examining: false, error: "",
    onUpdate: () => {}, onExam: () => {}, onClarify: () => {}, ...props }));
}

describe("notebook panel honesty and recovery", () => {
  it("shows saved quotes with source links, but does not label reloaded notes as new", () => {
    const html = render(data);
    expect(html).toContain('<blockquote>Assess likelihood.</blockquote>');
    expect(html).toContain('href="#message-m1"');
    expect(html).toContain('From your explanation');
    expect(html).toContain('<p>Assess likelihood.</p>');
    expect(html).not.toContain('class="note-new"');
    expect(render(data, { update: compareNotebookUpdate([], [note], "r1") })).toContain('class="note-new"');
  });
  it("keeps notes visible after an update error and offers a retry without claiming freshness", () => {
    const html = render({ ...data, learning: { ...data.learning, notebookFresh: false } }, { error: "Update failed.", update: compareNotebookUpdate([], [note], "r1") });
    expect(html).toContain('Assess likelihood.');
    expect(html).toContain('Update needed');
    expect(html).toContain('Retry notebook update');
    expect(html).not.toContain('class="note-new"');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Start student exam<\/button>/);
  });
  it("separates pending extraction from a completed extraction with no relevant statements", () => {
    const empty = { ...data, notebook: [] };
    const pending = render({ ...empty, learning: { ...data.learning, notebookFresh: false } }, { updating: true, disabled: true });
    expect(pending).toContain('Taking notes…');
    expect(pending).toContain('aria-busy="true"');
    expect(pending).not.toContain('No relevant statements were recorded');
    const completed = render({ ...empty, ai: { available: false, message: "Paused" } });
    expect(completed).toContain('No relevant statements were recorded');
    // The existing empty-notebook exam can still run without a paid model call.
    expect(completed).not.toMatch(/<button[^>]*disabled=""[^>]*>Start student exam<\/button>/);
  });
  it("does not show an old reply as interpretation of a new explanation", () => {
    const html = render({ ...data, messages: [explanation, { id: "s1", role: "student", text: "OLD INTERPRETATION", createdAt: explanation.createdAt, replyToMessageId: "m1" }, { ...explanation, id: "m2", text: "A different idea." }] }, { replying: true });
    expect(html).toContain('Reading your latest explanation');
    expect(html).not.toContain('OLD INTERPRETATION');
  });
  it("renders user quotes as text instead of executable markup", () => {
    const html = render({ ...data, notebook: [{ ...note, claim: '<script>alert("test")</script>' }] });
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });
  it("keeps the full original message available without replacing the exact note", () => {
    const html = render({ ...data, messages: [{ ...explanation, text: 'Assess likelihood. <b>This is source text.</b>' }] });
    expect(html).toContain('<blockquote>Assess likelihood.</blockquote>');
    expect(html).toContain('Assess likelihood. &lt;b&gt;This is source text.&lt;/b&gt;');
    expect(html).not.toContain('<b>This is source text.</b>');
  });
  it("does not spoil the score while the saved exam is being revealed", () => {
    const session = { ...data, latestAttempt: { id: 'exam', createdAt: explanation.createdAt, revision: 'r1', score: 2, total: 3, results: [], notebookSnapshot: [note], gaps: [] } };
    const html = render(session, { reviewing: true });
    expect(html).toContain('Your exam results are ready.');
    expect(html).not.toContain('2/3');
    expect(render(session)).toContain('Latest result: 2/3');
  });
});
