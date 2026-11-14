import { describe, expect, it } from "vitest";
import { gradeAnswers } from "../src/server/grading";
import type { ExamineeAnswer, NotebookEntry, Question } from "../src/lib/types";

const questions: Question[] = [
  { id: "one", text: "First test question", options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], correctAnswer: "a", requiredIdeaIds: ["idea-one"] },
  { id: "two", text: "Second test question", options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], correctAnswer: "b", requiredIdeaIds: ["idea-two"] },
];
const notebook: NotebookEntry[] = [{ id: "entry", claim: "A statement supplied by the user.", sourceMessageId: "message" }];
const answer = (questionId: string, value: string): ExamineeAnswer => ({ questionId, answer: value, reasoning: "Based on the notebook.", notebookRefs: ["entry"], guessed: false });

describe("answer-key grading", () => {
  it("counts supported correct answers and includes missing answers in the total", () => {
    const result = gradeAnswers(questions, [answer("one", "a")], notebook);
    expect(result.score).toBe(1);
    expect(result.total).toBe(2);
    expect(result.results[1]).toMatchObject({ correct: false, guessed: true, answer: null });
  });
  it("uses the answer key rather than the explanation", () => {
    expect(gradeAnswers(questions, [answer("one", "b"), answer("two", "a")], notebook).score).toBe(0);
  });
  it("rejects duplicate answers for the same question", () => {
    expect(gradeAnswers(questions, [answer("one", "a"), answer("one", "a")], notebook).score).toBe(0);
  });
  it("ignores answers to questions outside this attempt", () => {
    expect(gradeAnswers(questions, [answer("unknown", "a")], notebook).score).toBe(0);
  });
});
