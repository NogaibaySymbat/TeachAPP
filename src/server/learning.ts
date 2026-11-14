import "server-only";
import type { LearningState, NotebookResponse, SavedExamAttempt, SessionExport } from "@/lib/types";
import { extractNotebook } from "@/ai/notebook";
import { answerQuestions } from "@/ai/examinee";
import { buildDebriefFromContent } from "@/ai/debrief";
import { getQuestions, getTopic } from "./content";
import { ServiceError } from "./errors";
import { gradeAnswers } from "./grading";
import { findSession } from "./repositories/sessions";
import { claimLearning, failLearning, finishExam, finishNotebook, getLearningSnapshot } from "./repositories/learning";

export async function getSessionLearning(userId: string, sessionId: string) {
  const snapshot = await getLearningSnapshot(userId, sessionId);
  const [questions, topic] = await Promise.all([getQuestions(snapshot.session.topicId), getTopic(snapshot.session.topicId)]);
  const learning: LearningState = {
    revision: snapshot.revision, notebookRevision: snapshot.notebookRevision,
    notebookFresh: snapshot.revision === snapshot.notebookRevision, questionCount: questions.length,
  };
  return {
    session: snapshot.session, topic: { id: topic.id, title: topic.title, description: topic.description },
    messages: snapshot.messages, notebook: snapshot.notebook, learning,
    latestAttempt: snapshot.latestAttempt, previousAttempt: snapshot.previousAttempt,
  };
}
export async function exportSession(userId: string, sessionId: string): Promise<SessionExport> {
  // Ownership and all saved data are read inside one consistent transaction.
  const snapshot = await getLearningSnapshot(userId, sessionId, true);
  const topic = await getTopic(snapshot.session.topicId);
  return {
    formatVersion: 1, exportedAt: new Date().toISOString(),
    topic: { id: topic.id, title: topic.title, description: topic.description },
    session: snapshot.session, messages: snapshot.messages, notebook: snapshot.notebook,
    notebookFresh: snapshot.revision === snapshot.notebookRevision,
    attempts: [...snapshot.attempts].reverse(), legacyAttempts: snapshot.legacyAttempts,
  };
}
export async function updateNotebook(userId: string, sessionId: string): Promise<NotebookResponse> {
  const session = await findSession(userId, sessionId);
  const questions = await getQuestions(session.topicId);
  const claim = await claimLearning(userId, sessionId, "notebook");
  const learning = { revision: claim.revision, notebookRevision: claim.revision, notebookFresh: true, questionCount: questions.length };
  if (claim.kind === "cached") return { notebook: claim.notebook, learning };
  try {
    // Empty teaching is an empty notebook and never contacts a model.
    const entries = claim.messages.length ? await extractNotebook(claim.topicId, claim.messages) : [];
    const notebook = await finishNotebook(userId, sessionId, claim, entries);
    return { notebook, learning };
  } catch (error) {
    await failLearning(userId, sessionId, claim).catch(() => undefined);
    throw error;
  }
}
export async function runPracticeExam(userId: string, sessionId: string): Promise<SavedExamAttempt> {
  const claim = await claimLearning(userId, sessionId, "exam");
  if (claim.kind === "cached") return claim.attempt!;
  try {
    const [questions, topic] = await Promise.all([getQuestions(claim.topicId), getTopic(claim.topicId)]);
    if (!questions.length) throw new ServiceError(409, "EXAM_UNAVAILABLE", "This topic has no practice questions yet.");
    // Only public question fields cross the model boundary; answer keys stay in grading.
    const answers = await answerQuestions(questions.map(({ id, text, options }) => ({ id, text, options })), claim.notebook);
    const result = gradeAnswers(questions, answers, claim.notebook);
    const gaps = buildDebriefFromContent(result.results, questions, topic.keyIdeas);
    return await finishExam(userId, sessionId, claim, result, questions, topic.keyIdeas, gaps);
  } catch (error) {
    await failLearning(userId, sessionId, claim).catch(() => undefined);
    throw error;
  }
}
