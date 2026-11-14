import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExamineeAnswer, Message, NotebookEntry } from "../src/lib/types";

vi.mock("server-only", () => ({}));
vi.mock("../src/server/db", () => ({ getDatabase: () => database }));
const { extractNotebook, answerQuestions } = vi.hoisted(() => ({ extractNotebook: vi.fn(), answerQuestions: vi.fn() }));
vi.mock("../src/ai/notebook", () => ({ extractNotebook }));
vi.mock("../src/ai/examinee", () => ({ answerQuestions }));

import { getQuestions } from "../src/server/content";
import { getSessionLearning, runPracticeExam, updateNotebook } from "../src/server/learning";
import { claimLearning, explanationRevision, failLearning, finishNotebook, getLearningSnapshot, getSavedDebrief } from "../src/server/repositories/learning";
import { getMessages, saveMessage } from "../src/server/repositories/messages";
import { getNotebook } from "../src/server/repositories/notebook";
import { getProgressGaps, getTopicSummaries } from "../src/server/repositories/progress";
import { createSession } from "../src/server/repositories/sessions";
import { claimStudentReply } from "../src/server/repositories/student-replies";

const database = new Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 5 });
const users: string[] = [];
const teaching = "Stakeholders can affect or be affected by a project. Identify them early and revisit their needs when circumstances change.";
async function setup(text: string | null = teaching) {
  const userId = randomUUID();
  users.push(userId);
  const session = await createSession(userId, "stakeholders-demo");
  const source = text === null ? null : await saveMessage(userId, session.id, text);
  return { userId, sessionId: session.id, source };
}
async function clearCooldown(sessionId: string) {
  await database.query("UPDATE learning_jobs SET started_at = clock_timestamp() - interval '4 seconds' WHERE session_id = $1", [sessionId]);
}

beforeEach(() => {
  vi.resetAllMocks();
  extractNotebook.mockImplementation(async (_topicId: string, messages: Message[]) => messages.map((message) => ({ claim: message.text.slice(0, 200), sourceMessageId: message.id })));
  answerQuestions.mockImplementation(async (questions: { id: string }[], notebook: NotebookEntry[]): Promise<ExamineeAnswer[]> => {
    const keys = await getQuestions("stakeholders-demo");
    return questions.map((question) => ({
      questionId: question.id, answer: notebook.length ? keys.find((key) => key.id === question.id)!.correctAnswer : null,
      reasoning: notebook.length ? "Based on the supplied explanation." : "No notebook evidence.",
      notebookRefs: notebook.length ? [notebook[0].id] : [], guessed: !notebook.length,
    }));
  });
});

describe("learning revisions", () => {
  it("changes only when ordered user explanations change", () => {
    const first: Message = { id: randomUUID(), role: "user", text: "A", createdAt: "2026-01-01T00:00:00Z" };
    const second: Message = { ...first, id: randomUUID(), text: "B" };
    const reply: Message = { ...first, id: randomUUID(), role: "student", text: "Why?" };
    expect(explanationRevision([first, reply])).toBe(explanationRevision([first]));
    expect(explanationRevision([first, second])).not.toBe(explanationRevision([second, first]));
    expect(explanationRevision([{ ...first, text: "Changed" }])).not.toBe(explanationRevision([first]));
  });
});

describe.skipIf(!process.env.TEST_DATABASE_URL)("durable learning workflow", () => {
  beforeAll(async () => { await database.query(await readFile(new URL("../db/schema.sql", import.meta.url), "utf8")); });
  afterAll(async () => {
    await database.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [users]);
    await database.end();
  });

  it("persists one notebook and attempt per revision, with correct grading, gaps and progress", async () => {
    const { userId, sessionId } = await setup();
    const before = await getSessionLearning(userId, sessionId);
    expect(before.learning).toMatchObject({ notebookFresh: false, notebookRevision: null, questionCount: 3 });
    expect(before.latestAttempt).toBeNull();
    expect(JSON.stringify(before)).not.toContain("correctAnswer");
    const notebook = await updateNotebook(userId, sessionId);
    expect(notebook.learning.notebookFresh).toBe(true);
    expect(await updateNotebook(userId, sessionId)).toEqual(notebook);
    expect(extractNotebook).toHaveBeenCalledOnce();
    const attempt = await runPracticeExam(userId, sessionId);
    expect(attempt).toMatchObject({ score: 3, total: 3, gaps: [], notebookSnapshot: notebook.notebook });
    expect(attempt.results.every((result) => result.correct && result.correctAnswer === result.answer)).toBe(true);
    expect(await runPracticeExam(userId, sessionId)).toEqual(attempt);
    expect(answerQuestions).toHaveBeenCalledOnce();
    expect(JSON.stringify(answerQuestions.mock.calls[0][0])).not.toContain("correctAnswer");
    expect(JSON.stringify(answerQuestions.mock.calls[0][0])).not.toContain("requiredIdeaIds");
    expect((await getSessionLearning(userId, sessionId)).latestAttempt).toEqual(attempt);
    expect(await getSavedDebrief(userId, sessionId)).toEqual({ attemptId: attempt.id, gaps: [] });
    expect((await getTopicSummaries(userId))[0]).toMatchObject({ status: "passed", bestScore: 3 });
  });

  it("limits new notebook claims across one browser's sessions but permits cached reads and other browsers", async () => {
    const first = await setup();
    const second = await createSession(first.userId, "stakeholders-demo");
    await saveMessage(first.userId, second.id, teaching);
    const claim = await claimLearning(first.userId, first.sessionId, "notebook");
    expect(claim.kind).toBe("claimed");
    await expect(claimLearning(first.userId, second.id, "notebook")).rejects.toMatchObject({ code: "LEARNING_RATE_LIMIT" });
    if (claim.kind !== "claimed") throw new Error("Expected claim");
    await finishNotebook(first.userId, first.sessionId, claim, [{ claim: teaching, sourceMessageId: first.source!.id }]);
    expect((await claimLearning(first.userId, first.sessionId, "notebook")).kind).toBe("cached");
    const other = await setup();
    expect((await claimLearning(other.userId, other.sessionId, "notebook")).kind).toBe("claimed");
    await clearCooldown(first.sessionId);
    expect((await claimLearning(first.userId, second.id, "notebook")).kind).toBe("claimed");
  });

  it("allows an empty-teaching demo and persists its 0/3 review without notebook generation", async () => {
    const { userId, sessionId } = await setup(null);
    await expect(runPracticeExam(userId, sessionId)).rejects.toMatchObject({ code: "LEARNING_CHANGED" });
    expect((await updateNotebook(userId, sessionId)).notebook).toEqual([]);
    const attempt = await runPracticeExam(userId, sessionId);
    expect(attempt).toMatchObject({ score: 0, total: 3, notebookSnapshot: [] });
    expect(attempt.gaps).toHaveLength(3);
    expect(extractNotebook).not.toHaveBeenCalled();
    expect((await getTopicSummaries(userId))[0]).toMatchObject({ status: "failed", bestScore: 0 });
    expect(await getProgressGaps(userId)).toEqual(attempt.gaps);
  });

  it("serializes duplicate claims, requires current notebooks and keeps independent student replies compatible", async () => {
    const { userId, sessionId, source } = await setup();
    await claimStudentReply(userId, sessionId, source!.id);
    const results = await Promise.allSettled([claimLearning(userId, sessionId, "notebook"), claimLearning(userId, sessionId, "notebook")]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find((result) => result.status === "rejected")).toMatchObject({ reason: { code: "LEARNING_PENDING" } });
    const accepted = results.find((result) => result.status === "fulfilled");
    if (accepted?.status !== "fulfilled" || accepted.value.kind !== "claimed") throw new Error("Expected a claim");
    await finishNotebook(userId, sessionId, accepted.value, [{ claim: source!.text, sourceMessageId: source!.id }]);
    const examClaims = await Promise.allSettled([claimLearning(userId, sessionId, "exam"), claimLearning(userId, sessionId, "exam")]);
    expect(examClaims.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(examClaims.find((result) => result.status === "rejected")).toMatchObject({ reason: { code: "LEARNING_PENDING" } });
  });

  it("preserves source messages and prior notebook on failure, and throttles immediate retries", async () => {
    const { userId, sessionId, source } = await setup();
    extractNotebook.mockRejectedValueOnce(new Error("Provider unavailable"));
    await expect(updateNotebook(userId, sessionId)).rejects.toThrow("Provider unavailable");
    expect(await getMessages(userId, sessionId)).toEqual([source]);
    expect(await getNotebook(userId, sessionId)).toEqual([]);
    await expect(updateNotebook(userId, sessionId)).rejects.toMatchObject({ code: "LEARNING_RATE_LIMIT" });
    await clearCooldown(sessionId);
    expect((await updateNotebook(userId, sessionId)).notebook).toHaveLength(1);
  });

  it("fences expired workers and never lets their failure invalidate a newer claim", async () => {
    const { userId, sessionId, source } = await setup();
    const old = await claimLearning(userId, sessionId, "notebook");
    if (old.kind !== "claimed") throw new Error("Expected a claim");
    await database.query("UPDATE learning_jobs SET lease_until = clock_timestamp() - interval '1 second' WHERE session_id = $1", [sessionId]);
    await clearCooldown(sessionId);
    const current = await claimLearning(userId, sessionId, "notebook");
    if (current.kind !== "claimed") throw new Error("Expected a new claim");
    const entries = [{ claim: source!.text, sourceMessageId: source!.id }];
    await expect(finishNotebook(userId, sessionId, old, entries)).rejects.toMatchObject({ code: "LEARNING_CHANGED" });
    await failLearning(userId, sessionId, old);
    expect(await finishNotebook(userId, sessionId, current, entries)).toHaveLength(1);
  });

  it("rejects stale notebook results when teaching changes while the model works", async () => {
    const { userId, sessionId, source } = await setup();
    const claim = await claimLearning(userId, sessionId, "notebook");
    if (claim.kind !== "claimed") throw new Error("Expected a claim");
    await saveMessage(userId, sessionId, "An additional explanation.");
    await expect(finishNotebook(userId, sessionId, claim, [{ claim: source!.text, sourceMessageId: source!.id }])).rejects.toMatchObject({ code: "LEARNING_CHANGED" });
    expect((await getLearningSnapshot(userId, sessionId)).notebookRevision).toBeNull();
    expect(await getNotebook(userId, sessionId)).toEqual([]);
  });

  it("keeps historical question keys and notebook references after replacement, and rejects stale exams", async () => {
    const { userId, sessionId } = await setup();
    await updateNotebook(userId, sessionId);
    const firstAttempt = await runPracticeExam(userId, sessionId);
    await saveMessage(userId, sessionId, "Adapt communication to stakeholder needs and review engagement regularly.");
    await expect(runPracticeExam(userId, sessionId)).rejects.toMatchObject({ code: "LEARNING_CHANGED" });
    await clearCooldown(sessionId);
    const nextNotebook = await updateNotebook(userId, sessionId);
    expect(nextNotebook.notebook.some((entry) => entry.id === firstAttempt.notebookSnapshot[0].id)).toBe(false);
    expect((await getSessionLearning(userId, sessionId)).latestAttempt).toEqual(firstAttempt);
    expect(await getSavedDebrief(userId, sessionId, firstAttempt.id)).toEqual({ attemptId: firstAttempt.id, gaps: firstAttempt.gaps });
    const examClaim = await claimLearning(userId, sessionId, "exam");
    if (examClaim.kind !== "claimed") throw new Error("Expected a claim");
    await saveMessage(userId, sessionId, "One more new idea.");
    // The service performs the same fenced finish after grading; use a deferred
    // provider in the next test to verify that path without bypassing grading.
    expect((await getLearningSnapshot(userId, sessionId)).revision).not.toBe(examClaim.revision);
  });

  it("releases the connection during model work and discards an exam that finishes after new teaching", async () => {
    const { userId, sessionId } = await setup();
    await updateNotebook(userId, sessionId);
    let release!: (answers: ExamineeAnswer[]) => void;
    let entered!: () => void;
    const started = new Promise<void>((resolve) => { entered = resolve; });
    answerQuestions.mockImplementationOnce(() => { entered(); return new Promise<ExamineeAnswer[]>((resolve) => { release = resolve; }); });
    const pending = runPracticeExam(userId, sessionId);
    await started;
    expect(database.idleCount).toBe(database.totalCount);
    await saveMessage(userId, sessionId, "A newer explanation while the exam ran.");
    release([]);
    await expect(pending).rejects.toMatchObject({ code: "LEARNING_CHANGED" });
    expect((await getLearningSnapshot(userId, sessionId)).latestAttempt).toBeNull();
  });

  it("rejects fabricated notebook evidence and all cross-account access", async () => {
    const owner = await setup();
    const stranger = await setup();
    const claim = await claimLearning(owner.userId, owner.sessionId, "notebook");
    if (claim.kind !== "claimed") throw new Error("Expected a claim");
    await expect(finishNotebook(owner.userId, owner.sessionId, claim, [{ claim: "Invented knowledge", sourceMessageId: owner.source!.id }])).rejects.toMatchObject({ code: "NOTEBOOK_INVALID" });
    for (const operation of [
      () => getLearningSnapshot(stranger.userId, owner.sessionId),
      () => getSavedDebrief(stranger.userId, owner.sessionId),
      () => claimLearning(stranger.userId, owner.sessionId, "notebook"),
      () => finishNotebook(stranger.userId, owner.sessionId, claim, [{ claim: owner.source!.text, sourceMessageId: owner.source!.id }]),
    ]) await expect(operation()).rejects.toMatchObject({ code: "SESSION_NOT_FOUND" });
    await failLearning(stranger.userId, owner.sessionId, claim);
    expect(await finishNotebook(owner.userId, owner.sessionId, claim, [{ claim: owner.source!.text, sourceMessageId: owner.source!.id }])).toHaveLength(1);
  });

  it("rejects too much teaching before paid extraction instead of silently dropping older explanations", async () => {
    const { userId, sessionId } = await setup("a".repeat(7000));
    await saveMessage(userId, sessionId, "b".repeat(6000));
    await expect(updateNotebook(userId, sessionId)).rejects.toMatchObject({ code: "NOTEBOOK_CONTEXT_TOO_LONG" });
    expect(extractNotebook).not.toHaveBeenCalled();
    expect((await getMessages(userId, sessionId)).reduce((sum, item) => sum + item.text.length, 0)).toBe(13000);
  });
});
