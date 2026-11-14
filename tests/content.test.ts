import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getQuestions, getTopic, getTopics } from "../src/server/content";
import { gradeAnswers } from "../src/server/grading";

describe("authored practice content", () => {
  it("loads the advertised demo through the manifest with complete answer and idea references", async () => {
    const topics = await getTopics();
    expect(topics.some((topic) => topic.id === "stakeholders-demo")).toBe(true);
    const topic = await getTopic("stakeholders-demo");
    const questions = await getQuestions(topic.id);

    expect(topic.title).toContain("Demo");
    expect(questions).toHaveLength(3);
    expect(new Set(questions.map((question) => question.id)).size).toBe(questions.length);
    const ideaIds = new Set(topic.keyIdeas.map((idea) => idea.id));
    expect(ideaIds.size).toBe(3);
    const assessedIdeas = new Set<string>();
    for (const question of questions) {
      const optionIds = question.options.map((option) => option.id);
      expect(new Set(optionIds).size).toBe(optionIds.length);
      expect(optionIds).toContain(question.correctAnswer);
      for (const ideaId of question.requiredIdeaIds) {
        expect(ideaIds.has(ideaId)).toBe(true);
        assessedIdeas.add(ideaId);
      }
    }
    expect(assessedIdeas).toEqual(ideaIds);
  });

  it("grades the real practice set as zero without teaching, including unanswered questions", async () => {
    const questions = await getQuestions("stakeholders-demo");
    const result = gradeAnswers(questions, [], []);
    expect(result.score).toBe(0);
    expect(result.total).toBe(3);
    expect(result.results.every((answer) => answer.guessed && !answer.correct)).toBe(true);
  });

  it("can grade every authored answer key with existing notebook references", async () => {
    const questions = await getQuestions("stakeholders-demo");
    // This checks content/grading integration, not the model's semantic grounding.
    const notebook = [{ id: "note", claim: "A learner-supplied explanation.", sourceMessageId: "message" }];
    const answers = questions.map((question) => ({
      questionId: question.id,
      answer: question.correctAnswer,
      reasoning: "A supported answer fixture.",
      notebookRefs: ["note"],
      guessed: false,
    }));
    const result = gradeAnswers(questions, answers, notebook);
    expect(result.score).toBe(3);
    expect(result.total).toBe(3);
  });
});
