import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getQuestions, getTopic, getTopics } from "../src/server/content";
import { gradeAnswers } from "../src/server/grading";

describe("authored practice content", () => {
  it("loads all four topics with three distinct questions covering their authored ideas", async () => {
    const topics = await getTopics();
    expect(topics.map((topic) => topic.id)).toEqual(["stakeholders-demo", "risk-basics", "change-control", "scrum-delivery"]);
    const questionIds = new Set<string>();
    for (const topic of topics) {
      const questions = await getQuestions(topic.id);
      expect(questions).toHaveLength(3);
      expect(new Set(questions.flatMap((question) => question.requiredIdeaIds))).toEqual(new Set(topic.keyIdeas.map((idea) => idea.id)));
      for (const question of questions) {
        expect(questionIds.has(question.id)).toBe(false);
        questionIds.add(question.id);
        expect(question.options).toHaveLength(4);
        expect(question.options.some((option) => option.id === question.correctAnswer)).toBe(true);
        expect(JSON.stringify(question)).not.toContain("TODO");
      }
      expect(gradeAnswers(questions, [], []).score).toBe(0);
    }
    expect(questionIds.size).toBe(12);
  });
  it("loads the advertised demo through the manifest with complete answer and idea references", async () => {
    const topics = await getTopics();
    expect(topics.some((topic) => topic.id === "stakeholders-demo")).toBe(true);
    const topic = await getTopic("stakeholders-demo");
    const questions = await getQuestions(topic.id);

    // Every key idea names its area without repeating the idea itself.
    for (const item of topics) {
      const full = await getTopic(item.id);
      for (const idea of full.keyIdeas) {
        expect(idea.label?.trim()).toBeTruthy();
        expect(idea.text.toLowerCase()).not.toContain(idea.label!.toLowerCase());
      }
    }
    // Topic titles are user-facing; internal labels such as "Demo" stay out of them.
    expect(topic.title).toBe("Project stakeholders");
    expect(topics.every((item) => !/\b(demo|practice)\b/i.test(item.title))).toBe(true);
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
