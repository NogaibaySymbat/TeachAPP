import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatMessage, ExamineeAnswer, NotebookEntry, Question, Topic } from "../src/lib/types";

vi.mock("server-only", () => ({}));
const { completeJson, getTopic, getQuestions } = vi.hoisted(() => ({ completeJson: vi.fn(), getTopic: vi.fn(), getQuestions: vi.fn() }));
vi.mock("../src/ai/client", () => ({ completeJson }));
vi.mock("../src/server/content", () => ({ getTopic, getQuestions }));

import { extractNotebook } from "../src/ai/notebook";
import { answerQuestion, answerQuestions } from "../src/ai/examinee";
import { buildDebrief, buildDebriefFromContent } from "../src/ai/debrief";
import { gradeAnswers } from "../src/server/grading";

const topic: Topic = {
  id: "stakeholders", title: "Stakeholder engagement", description: "A topic",
  keyIdeas: [{ id: "idea-one", text: "SECRET AUTHOR-ONLY IDEA" }, { id: "idea-two", label: "how to adapt communication", text: "Adapt communication." }],
  misconceptions: ["SECRET AUTHOR-ONLY MISCONCEPTION"],
};
const question: Question = {
  id: "question-one", text: "Who needs to be considered?", options: [{ id: "a", text: "Only the team" }, { id: "b", text: "Anyone affected by the project" }],
  correctAnswer: "b", requiredIdeaIds: ["idea-one"],
};
const secondQuestion: Question = { ...question, id: "question-two", requiredIdeaIds: ["idea-two"] };
const message = (text: string, id = "message-one", role: ChatMessage["role"] = "user"): ChatMessage => ({ id, text, role, createdAt: "2026-11-14T00:00:00Z" });
const claim = "Stakeholders include anyone affected by the project.";
const notebook: NotebookEntry[] = [{ id: "entry-one", claim, sourceMessageId: "message-one" }];
const supported: ExamineeAnswer = { questionId: question.id, answer: "b", reasoning: "The teacher included anyone affected.", notebookRefs: ["entry-one"], guessed: false };
let modelOutput: unknown;

beforeEach(() => {
  vi.clearAllMocks();
  getTopic.mockResolvedValue(topic);
  getQuestions.mockResolvedValue([question, secondQuestion]);
  completeJson.mockImplementation(async (_messages, validate) => validate(modelOutput));
});

describe("notebook from user teaching", () => {
  it("returns empty without a model request for empty, blank or student-only input", async () => {
    for (const messages of [[], [message("  ")], [message(claim, "student-message", "student")]]) {
      expect(await extractNotebook(topic.id, messages)).toEqual([]);
    }
    expect(completeJson).not.toHaveBeenCalled();
  });

  it("keeps exact quoted claims and sends only user messages plus the topic title", async () => {
    const entries = [{ claim, sourceMessageId: "message-one" }];
    modelOutput = { entries };
    expect(await extractNotebook(topic.id, [message(claim), message("SECRET STUDENT TEXT", "student-message", "student")])).toEqual(entries);
    const [messages, , options] = completeJson.mock.calls[0];
    const payload = JSON.parse(messages[1].content);
    expect(payload).toEqual({ topic: topic.title, messages: [{ id: "message-one", text: claim }] });
    expect(JSON.stringify(messages)).not.toContain("SECRET");
    expect(options).toMatchObject({ maxOutputTokens: 1024, jsonSchema: { name: "teachapp_notebook" } });
  });

  it.each([
    { claim: "Invented definition not present in source.", sourceMessageId: "message-one" },
    { claim, sourceMessageId: "phantom-message" },
    { claim: "  ", sourceMessageId: "message-one" },
    { claim: ` ${claim}`, sourceMessageId: "message-one" },
  ])("rejects ungrounded or malformed model extraction %j", async (entry) => {
    modelOutput = { entries: [entry] };
    await expect(extractNotebook(topic.id, [message(claim)])).rejects.toThrow();
    expect(completeJson).toHaveBeenCalledTimes(1);
  });

  it("does not correct a teacher's misconception", async () => {
    const incorrect = "Only people on the team can be stakeholders.";
    const entries = [{ claim: incorrect, sourceMessageId: "message-one" }];
    modelOutput = { entries };
    expect(await extractNotebook(topic.id, [message(incorrect)])).toEqual(entries);
  });

  it("rejects duplicate model claims and ambiguous source IDs", async () => {
    const entry = { claim, sourceMessageId: "message-one" };
    modelOutput = { entries: [entry, entry] };
    await expect(extractNotebook(topic.id, [message(claim)])).rejects.toThrow();
    completeJson.mockClear();
    await expect(extractNotebook(topic.id, [message(claim), message("Different text")])).rejects.toMatchObject({ code: "AI_INVALID_CONTEXT" });
    expect(completeJson).not.toHaveBeenCalled();
  });

  it("rejects oversized sessions before spending and never silently omits earlier teaching", async () => {
    await expect(extractNotebook(topic.id, [message("x".repeat(12_001))])).rejects.toMatchObject({ code: "AI_CONTEXT_TOO_LONG" });
    await expect(extractNotebook(topic.id, Array.from({ length: 25 }, (_, index) => message("Teaching", `id-${index}`)))).rejects.toMatchObject({ code: "AI_CONTEXT_TOO_LONG" });
    expect(completeJson).not.toHaveBeenCalled();
  });

  it("an empty extraction of unrelated teaching produces zero marks without another model call", async () => {
    modelOutput = { entries: [] };
    const entries = await extractNotebook(topic.id, [message("Purple clouds eat triangles.")]);
    const answers = await answerQuestions([question], entries.map((entry, index) => ({ ...entry, id: `entry-${index}` })));
    expect(gradeAnswers([question], answers, [])).toMatchObject({ score: 0, total: 1 });
    expect(completeJson).toHaveBeenCalledTimes(1);
  });
});

describe("notebook-only exam", () => {
  it("abstains on every question for an empty notebook, without API spend", async () => {
    const answers = await answerQuestions([question, secondQuestion], []);
    expect(answers).toHaveLength(2);
    for (const answer of answers) expect(answer).toMatchObject({ answer: null, guessed: true, notebookRefs: [] });
    expect(gradeAnswers([question, secondQuestion], answers, [])).toMatchObject({ score: 0, total: 2 });
    expect(completeJson).not.toHaveBeenCalled();
  });

  it("batches questions once and excludes keys, key idea IDs, source IDs and unexpected caller fields", async () => {
    modelOutput = { answers: [{ ...supported, questionId: secondQuestion.id }, supported] };
    const enriched = { ...question, chat: "SECRET CHAT", keyIdeas: topic.keyIdeas };
    expect(await answerQuestions([enriched, secondQuestion], notebook)).toEqual([supported, { ...supported, questionId: secondQuestion.id }]);
    expect(completeJson).toHaveBeenCalledTimes(1);
    const [messages, , options] = completeJson.mock.calls[0];
    const payload = JSON.parse(messages[1].content);
    expect(payload).toEqual({
      questions: [question, secondQuestion].map(({ id, text, options }) => ({ id, text, options })),
      notebook: [{ id: "entry-one", claim }],
    });
    for (const secret of ["correctAnswer", "requiredIdeaIds", "sourceMessageId", "SECRET"]) expect(JSON.stringify(payload)).not.toContain(secret);
    expect(options).toMatchObject({ maxOutputTokens: 768, jsonSchema: { name: "teachapp_exam" } });
  });

  it.each([
    { answers: [supported, supported] },
    { answers: [] },
    { answers: [{ ...supported, questionId: "phantom-question" }] },
    { answers: [{ ...supported, answer: "phantom-option" }] },
    { answers: [{ ...supported, reasoning: "x".repeat(301) }] },
  ])("rejects malformed question answers without another generation: %j", async (output) => {
    modelOutput = output;
    await expect(answerQuestions([question], notebook)).rejects.toThrow();
    expect(completeJson).toHaveBeenCalledTimes(1);
  });

  it.each([
    { notebookRefs: [] },
    { notebookRefs: ["unknown-entry"] },
    { notebookRefs: ["entry-one", "entry-one"] },
    { notebookRefs: ["entry-one", "unknown-entry"] },
    { guessed: true },
    { answer: null },
  ])("turns unsupported answer into an abstention: %j", async (override) => {
    modelOutput = { answers: [{ ...supported, ...override }] };
    const answers = await answerQuestions([question], notebook);
    expect(answers[0]).toMatchObject({ answer: null, guessed: true, notebookRefs: [] });
    expect(gradeAnswers([question], answers, notebook).score).toBe(0);
  });

  it("preserves the single-question adapter", async () => {
    modelOutput = { answers: [supported] };
    expect(await answerQuestion(question, notebook)).toEqual(supported);
  });

  it("rejects ambiguous IDs and excessive question batches before spending", async () => {
    await expect(answerQuestions([question, question], notebook)).rejects.toMatchObject({ code: "AI_INVALID_CONTEXT" });
    await expect(answerQuestions([question], [notebook[0], notebook[0]])).rejects.toMatchObject({ code: "AI_INVALID_CONTEXT" });
    await expect(answerQuestions(Array.from({ length: 7 }, (_, index) => ({ ...question, id: `question-${index}` })), notebook)).rejects.toMatchObject({ code: "AI_CONTEXT_TOO_LONG" });
    expect(completeJson).not.toHaveBeenCalled();
  });
});

describe("deterministic debrief", () => {
  it("uses the grading snapshot for failed questions and never calls the model", () => {
    const answers = [{ ...supported, correct: true }, { ...supported, questionId: secondQuestion.id, correct: false }];
    expect(buildDebriefFromContent(answers, [question, secondQuestion], topic.keyIdeas)).toEqual([
      { questionId: secondQuestion.id, missingIdea: "Explain how to adapt communication in your own words, then retake." },
    ]);
    expect(completeJson).not.toHaveBeenCalled();
    expect(getTopic).not.toHaveBeenCalled();
    // The debrief names the area to explain, never the idea's full text.
    expect(JSON.stringify(buildDebriefFromContent(answers, [question, secondQuestion], topic.keyIdeas))).not.toMatch(/Adapt communication\.|SECRET AUTHOR-ONLY IDEA/);
  });

  it("returns no gaps for a passed exam without loading content or calling a model", async () => {
    expect(await buildDebrief(topic.id, [{ ...supported, correct: true }], notebook)).toEqual([]);
    expect(getTopic).not.toHaveBeenCalled();
    expect(completeJson).not.toHaveBeenCalled();
  });

  it("retains a convenience wrapper without spending API tokens", async () => {
    expect(await buildDebrief(topic.id, [{ ...supported, correct: false }], notebook)).toEqual([
      { questionId: question.id, missingIdea: "Explain the idea behind this question in your own words, then retake." },
    ]);
    expect(completeJson).not.toHaveBeenCalled();
  });
});
