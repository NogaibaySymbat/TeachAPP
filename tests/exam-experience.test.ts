import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ExamReview } from "../src/components/exam-review";
import { AttemptComparison } from "../src/components/attempt-comparison";
import type { SavedExamAttempt } from "../src/lib/types";

function attempt(id: string, correct: boolean[]): SavedExamAttempt {
  return {
    id, createdAt: "2026-11-15T00:00:00Z", revision: id, score: correct.filter(Boolean).length, total: correct.length,
    notebookSnapshot: [{ id: "snapshot-note", claim: "Saved exam evidence.", sourceMessageId: "message-1" }], gaps: [],
    results: correct.map((value, index) => ({ questionId: `q${index}`, questionText: `Practice question ${index + 1}`,
      options: [{ id: "a", text: `Correct option ${index + 1}` }, { id: "b", text: "Different option" }],
      correctAnswer: "a", answer: value ? "a" : "b", correct: value, guessed: false,
      reasoning: `Saved reasoning ${index + 1}`, notebookRefs: ["snapshot-note"] })),
  };
}

function review(props: Partial<ComponentProps<typeof ExamReview>> = {}) {
  return renderToStaticMarkup(createElement(ExamReview, {
    attempt: attempt("new", [false, true, false]), previousAttempt: null, stale: false,
    disabled: false, debriefError: "", onDebrief: () => {}, onExplain: () => {}, ...props,
  }));
}

describe("saved exam walkthrough", () => {
  it("shows just the first saved answer without revealing the total or later answers", () => {
    const html = review({ walkthrough: true });
    expect(html).toContain("Question 1 of 3");
    expect(html).toContain("Saved reasoning 1");
    expect(html).toContain("Saved exam evidence.");
    expect(html).toContain("Show all results");
    expect(html).not.toContain("Practice question 2");
    expect(html).not.toContain("Saved reasoning 2");
    expect(html).not.toContain("scored 1/3");
  });
  it("shows reloaded results immediately and offers an optional saved walkthrough", () => {
    const html = review({ onWalkthroughChange: () => {} });
    expect(html).toContain("Milo scored 1/3");
    expect(html).toContain("Practice question 3");
    expect(html).toContain("Review one question at a time");
  });
  it("shows stale results in full with the earlier-notebook warning", () => {
    const html = review({ stale: true, walkthrough: true });
    expect(html).toContain("earlier notebook");
    expect(html).toContain("Practice question 3");
    expect(html).not.toContain("Next question");
  });
  it.each([true, false])("does not leak failed question keys in walkthrough=%s", (walkthrough) => {
    const html = review({ walkthrough });
    expect(html).not.toContain("Correct option 1");
    expect(html).not.toContain("Correct option 3");
    expect(html).toContain("Hidden until your student passes");
    expect(html).toContain("Help Milo with this question");
  });
  it("distinguishes a real abstention from an unsupported selected answer", () => {
    const data = attempt("new", [false]);
    data.results[0].guessed = true;
    expect(review({ attempt: data })).toContain("Not counted · unsupported answer");
    data.results[0].answer = null;
    expect(review({ attempt: data })).toContain("Skipped · no supported answer");
  });
  it("handles an empty saved result without an invalid question or walkthrough", () => {
    const html = review({ attempt: attempt("empty", []), walkthrough: true });
    expect(html).not.toContain("Next question");
    expect(html).not.toContain("Question 1 of 0");
  });
});

describe("earned feedback", () => {
  function comparison(previous: SavedExamAttempt, current: SavedExamAttempt) {
    return renderToStaticMarkup(createElement(AttemptComparison, { previous, current, celebrate: true }));
  }
  it("celebrates an actual comparable improvement", () => {
    const html = comparison(attempt("a", [true, false, false]), attempt("b", [true, true, false]));
    expect(html).toContain("1 more answer correct this time");
    expect(html).toContain("is-celebrating");
    expect(html).toContain("1/3");
    expect(html).toContain("2/3");
  });
  it("does not celebrate a regression, a flat score, or changed questions", () => {
    const before = attempt("a", [true, false]);
    const after = attempt("b", [true, true]);
    after.results[0].questionText = "A different exam";
    for (const current of [attempt("b", [false, false]), attempt("b", [false, true]), after]) {
      expect(comparison(before, current)).not.toContain("is-celebrating");
    }
  });
});
