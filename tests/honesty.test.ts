import { describe, expect, it } from "vitest";
import { gradeAnswers } from "../src/server/grading";
import type { ExamineeAnswer, Question } from "../src/lib/types";

const question: Question = { id: "question", text: "A test question", options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], correctAnswer: "a", requiredIdeaIds: ["idea"] };
const answer: ExamineeAnswer = { questionId: "question", answer: "a", reasoning: "An answer that happens to be right.", notebookRefs: ["entry"], guessed: false };
const notebook = [{ id: "entry", claim: "User-supplied statement.", sourceMessageId: "message" }];

describe("deterministic grounding safeguards", () => {
  it("gives an empty notebook zero even when the selected answer is correct", () => {
    expect(gradeAnswers([question], [answer], []).score).toBe(0);
  });
  it("gives guesses zero even when the selected answer is correct", () => {
    expect(gradeAnswers([question], [{ ...answer, guessed: true }], notebook).score).toBe(0);
  });
  it("gives answers without notebook references zero", () => {
    expect(gradeAnswers([question], [{ ...answer, notebookRefs: [] }], notebook).score).toBe(0);
  });
  it("rejects an answer if any cited entry is absent", () => {
    expect(gradeAnswers([question], [{ ...answer, notebookRefs: ["entry", "invented"] }], notebook).score).toBe(0);
  });
});
