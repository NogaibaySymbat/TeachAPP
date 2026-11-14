import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import type { ExamResult, Gap, Message, NotebookEntry, Question, SavedExamAttempt, Session, SessionExport, Topic } from "@/lib/types";
import { getDatabase } from "../db";
import { ServiceError } from "../errors";
import { serializeMessage, type MessageRow } from "./messages";

type Operation = "notebook" | "exam";
interface SessionRow { id: string; topic_id: string; started_at: Date; finished_at: Date | null; notebook_revision: string | null }
interface AttemptRow {
  id: string; created_at: Date; learning_revision: string; score: number; total: number;
  notebook_snapshot: NotebookEntry[]; questions_snapshot: Question[]; key_ideas_snapshot: Topic["keyIdeas"]; gaps: Gap[] | null;
}
export interface LearningSnapshot {
  session: Session; messages: Message[]; notebook: NotebookEntry[]; notebookRevision: string | null;
  revision: string; latestAttempt: SavedExamAttempt | null; previousAttempt: SavedExamAttempt | null;
  attempts: SavedExamAttempt[];
  legacyAttempts: SessionExport["legacyAttempts"];
}
export interface LearningClaim {
  kind: "claimed"; operation: Operation; revision: string; attemptToken: string;
  topicId: string; messages: Message[]; notebook: NotebookEntry[];
}
type ClaimResult = LearningClaim | { kind: "cached"; notebook: NotebookEntry[]; revision: string; attempt: SavedExamAttempt | null };
const notFound = () => new ServiceError(404, "SESSION_NOT_FOUND", "This session could not be found for this user.");
const stale = () => new ServiceError(409, "LEARNING_CHANGED", "Your explanation changed. Update the notebook before trying again.");

export function explanationRevision(messages: Message[]): string {
  return createHash("sha256").update(JSON.stringify(messages.filter((message) => message.role === "user").map(({ id, text }) => [id, text]))).digest("hex");
}
async function readMessages(client: PoolClient, id: string): Promise<Message[]> {
  const rows = await client.query<MessageRow>("SELECT id, role, text, created_at, reply_to_message_id FROM messages WHERE session_id = $1 ORDER BY created_at, id", [id]);
  return rows.rows.map(serializeMessage);
}
async function readNotebook(client: PoolClient, id: string): Promise<NotebookEntry[]> {
  const rows = await client.query<{ id: string; claim: string; source_message_id: string }>("SELECT id, claim, source_message_id FROM notebook_entries WHERE session_id = $1 ORDER BY id", [id]);
  return rows.rows.map(({ id, claim, source_message_id }) => ({ id, claim, sourceMessageId: source_message_id }));
}
async function ownedSession(client: PoolClient, userId: string, id: string, lock = false): Promise<SessionRow> {
  const result = await client.query<SessionRow>(`SELECT id, topic_id, started_at, finished_at, notebook_revision FROM sessions WHERE id = $1 AND user_id = $2${lock ? " FOR UPDATE" : ""}`, [id, userId]);
  if (!result.rows[0]) throw notFound();
  return result.rows[0];
}
async function readAttempts(client: PoolClient, sessionId: string, revision?: string, attemptId?: string, limit: number | null = 1): Promise<SavedExamAttempt[]> {
  const result = await client.query<AttemptRow>(
    `SELECT id, created_at, learning_revision, score, total, notebook_snapshot, questions_snapshot, key_ideas_snapshot, gaps
     FROM exam_attempts WHERE session_id = $1 AND learning_revision IS NOT NULL
     AND ($2::text IS NULL OR learning_revision = $2) AND ($3::uuid IS NULL OR id = $3)
     ORDER BY created_at DESC, id DESC LIMIT $4`, [sessionId, revision ?? null, attemptId ?? null, limit],
  );
  if (!result.rows.length) return [];
  const answers = await client.query<{
    attempt_id: string; question_id: string; answer: string | null; correct: boolean; guessed: boolean; reasoning: string; notebook_refs: string[];
  }>("SELECT attempt_id, question_id, answer, correct, guessed, reasoning, notebook_refs FROM exam_answers WHERE attempt_id = ANY($1::uuid[])", [result.rows.map((row) => row.id)]);
  return result.rows.map((row) => ({
    id: row.id, createdAt: row.created_at.toISOString(), revision: row.learning_revision, score: row.score, total: row.total,
    notebookSnapshot: row.notebook_snapshot, gaps: row.gaps,
    results: row.questions_snapshot.map((question) => {
      const answer = answers.rows.find((answer) => answer.attempt_id === row.id && answer.question_id === question.id);
      if (!answer) throw new Error("Saved practice attempt is incomplete.");
      return {
        questionId: question.id, questionText: question.text, options: question.options, correctAnswer: question.correctAnswer,
        answer: answer.answer, correct: answer.correct, guessed: answer.guessed, reasoning: answer.reasoning, notebookRefs: answer.notebook_refs,
      };
    }),
  }));
}
async function readAttempt(client: PoolClient, sessionId: string, revision?: string, attemptId?: string): Promise<SavedExamAttempt | null> {
  return (await readAttempts(client, sessionId, revision, attemptId))[0] ?? null;
}
async function readLegacyAttempts(client: PoolClient, sessionId: string): Promise<SessionExport["legacyAttempts"]> {
  const result = await client.query<{ id: string; created_at: Date; score: number; total: number; results: ExamResult["results"] }>(
    `SELECT a.id, a.created_at, a.score, a.total,
      COALESCE(jsonb_agg(jsonb_build_object('questionId', e.question_id, 'answer', e.answer,
        'correct', e.correct, 'guessed', e.guessed, 'reasoning', e.reasoning, 'notebookRefs', e.notebook_refs)
        ORDER BY e.question_id) FILTER (WHERE e.question_id IS NOT NULL), '[]'::jsonb) AS results
     FROM exam_attempts a LEFT JOIN exam_answers e ON e.attempt_id = a.id
     WHERE a.session_id = $1 AND a.learning_revision IS NULL
     GROUP BY a.id ORDER BY a.created_at, a.id`, [sessionId],
  );
  return result.rows.map((row) => ({ id: row.id, createdAt: row.created_at.toISOString(), score: row.score, total: row.total, results: row.results }));
}
export async function getLearningSnapshot(userId: string, sessionId: string, includeAllAttempts = false): Promise<LearningSnapshot> {
  const client = await getDatabase().connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const row = await ownedSession(client, userId, sessionId);
    const messages = await readMessages(client, sessionId);
    const notebook = await readNotebook(client, sessionId);
    const attempts = await readAttempts(client, sessionId, undefined, undefined, includeAllAttempts ? null : 2);
    const legacyAttempts = includeAllAttempts ? await readLegacyAttempts(client, sessionId) : [];
    await client.query("COMMIT");
    return {
      session: { id: row.id, topicId: row.topic_id, startedAt: row.started_at.toISOString(), finishedAt: row.finished_at?.toISOString() ?? null },
      messages, notebook, notebookRevision: row.notebook_revision, revision: explanationRevision(messages),
      latestAttempt: attempts[0] ?? null, previousAttempt: attempts[1] ?? null, attempts, legacyAttempts,
    };
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
export async function claimLearning(userId: string, sessionId: string, operation: Operation): Promise<ClaimResult> {
  const client = await getDatabase().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [userId]);
    const row = await ownedSession(client, userId, sessionId, true);
    const messages = (await readMessages(client, sessionId)).filter((message) => message.role === "user");
    const revision = explanationRevision(messages);
    const notebook = await readNotebook(client, sessionId);
    const attempt = operation === "exam" ? await readAttempt(client, sessionId, revision) : null;
    if ((operation === "notebook" && row.notebook_revision === revision) || attempt) {
      await client.query("COMMIT");
      return { kind: "cached", notebook, revision, attempt };
    }
    if (operation === "exam" && row.notebook_revision !== revision) throw stale();
    if (operation === "notebook" && (messages.length > 24 || messages.reduce((sum, message) => sum + message.text.length, 0) > 12000)) {
      throw new ServiceError(400, "NOTEBOOK_CONTEXT_TOO_LONG", "Your explanations are saved. This practice session supports up to 24 explanations and 12,000 characters. Start a new session to continue.");
    }
    const pending = await client.query(
      "SELECT 1 FROM learning_jobs WHERE session_id = $1 AND operation = $2 AND status = 'pending' AND lease_until > clock_timestamp()", [sessionId, operation],
    );
    if (pending.rowCount) throw new ServiceError(409, "LEARNING_PENDING", "This step is already running. Wait a moment, then refresh the session.");
    const recent = await client.query(
      `SELECT 1 FROM learning_jobs j JOIN sessions s ON s.id = j.session_id
       WHERE s.user_id = $1 AND j.operation = $2
       AND j.started_at > clock_timestamp() - interval '3 seconds' LIMIT 1`, [userId, operation],
    );
    if (recent.rowCount) throw new ServiceError(429, "LEARNING_RATE_LIMIT", "Wait a few seconds before retrying this step.");
    const attemptToken = randomUUID();
    await client.query(
      `INSERT INTO learning_jobs (session_id, operation, revision, status, attempt_token, lease_until)
       VALUES ($1, $2, $3, 'pending', $4, clock_timestamp() + interval '90 seconds')
       ON CONFLICT (session_id, operation, revision) DO UPDATE SET status = 'pending', attempt_token = EXCLUDED.attempt_token,
       lease_until = EXCLUDED.lease_until, started_at = clock_timestamp()`, [sessionId, operation, revision, attemptToken],
    );
    await client.query("COMMIT");
    return { kind: "claimed", operation, revision, attemptToken, topicId: row.topic_id, messages, notebook };
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
async function verifyClaim(client: PoolClient, userId: string, sessionId: string, claim: LearningClaim): Promise<void> {
  const row = await ownedSession(client, userId, sessionId, true);
  const job = await client.query(
    `SELECT 1 FROM learning_jobs WHERE session_id = $1 AND operation = $2 AND revision = $3
     AND attempt_token = $4 AND status = 'pending' AND lease_until > clock_timestamp() FOR UPDATE`,
    [sessionId, claim.operation, claim.revision, claim.attemptToken],
  );
  if (!job.rowCount || explanationRevision(await readMessages(client, sessionId)) !== claim.revision) throw stale();
  if (claim.operation === "exam" && row.notebook_revision !== claim.revision) throw stale();
}
async function completeClaim(client: PoolClient, sessionId: string, claim: LearningClaim): Promise<void> {
  await client.query("UPDATE learning_jobs SET status = 'completed' WHERE session_id = $1 AND operation = $2 AND revision = $3 AND attempt_token = $4", [sessionId, claim.operation, claim.revision, claim.attemptToken]);
}
export async function finishNotebook(userId: string, sessionId: string, claim: LearningClaim, entries: Omit<NotebookEntry, "id">[]): Promise<NotebookEntry[]> {
  if (claim.operation !== "notebook" || entries.length > 12 || entries.some((entry) => !entry.claim.trim() || entry.claim.length > 500 || !claim.messages.some((message) => message.id === entry.sourceMessageId && message.role === "user" && message.text.includes(entry.claim)))) {
    throw new ServiceError(502, "NOTEBOOK_INVALID", "The notebook could not be grounded in your explanation. Your messages are saved; please retry.");
  }
  const client = await getDatabase().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [userId]);
    await verifyClaim(client, userId, sessionId, claim);
    await client.query("DELETE FROM notebook_entries WHERE session_id = $1", [sessionId]);
    for (const entry of entries) {
      await client.query("INSERT INTO notebook_entries (session_id, claim, source_message_id) VALUES ($1, $2, $3)", [sessionId, entry.claim, entry.sourceMessageId]);
    }
    await client.query("UPDATE sessions SET notebook_revision = $2 WHERE id = $1", [sessionId, claim.revision]);
    await completeClaim(client, sessionId, claim);
    const notebook = await readNotebook(client, sessionId);
    await client.query("COMMIT");
    return notebook;
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
export async function finishExam(userId: string, sessionId: string, claim: LearningClaim, result: ExamResult, questions: Question[], keyIdeas: Topic["keyIdeas"], gaps: Gap[]): Promise<SavedExamAttempt> {
  if (claim.operation !== "exam") throw stale();
  const client = await getDatabase().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [userId]);
    await verifyClaim(client, userId, sessionId, claim);
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO exam_attempts (session_id, score, total, learning_revision, notebook_snapshot, questions_snapshot, key_ideas_snapshot, gaps, created_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, clock_timestamp()) RETURNING id`,
      [sessionId, result.score, result.total, claim.revision, JSON.stringify(claim.notebook), JSON.stringify(questions), JSON.stringify(keyIdeas), JSON.stringify(gaps)],
    );
    for (const answer of result.results) {
      await client.query(
        `INSERT INTO exam_answers (attempt_id, question_id, answer, correct, guessed, reasoning, notebook_refs)
         VALUES ($1, $2, $3, $4, $5, $6, $7::uuid[])`,
        [inserted.rows[0].id, answer.questionId, answer.answer, answer.correct, answer.guessed, answer.reasoning, answer.notebookRefs],
      );
    }
    await client.query(
      `INSERT INTO topic_progress (user_id, topic_id, status, best_score, last_session_at) VALUES ($1, $2, $3, $4, clock_timestamp())
       ON CONFLICT (user_id, topic_id) DO UPDATE SET status = EXCLUDED.status,
       best_score = GREATEST(topic_progress.best_score, EXCLUDED.best_score), last_session_at = EXCLUDED.last_session_at`,
      [userId, claim.topicId, result.score === result.total ? "passed" : "failed", result.score],
    );
    await client.query("UPDATE sessions SET finished_at = clock_timestamp() WHERE id = $1", [sessionId]);
    await completeClaim(client, sessionId, claim);
    const attempt = await readAttempt(client, sessionId, claim.revision);
    await client.query("COMMIT");
    return attempt!;
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
export async function failLearning(userId: string, sessionId: string, claim: LearningClaim): Promise<void> {
  await getDatabase().query(
    `UPDATE learning_jobs j SET status = 'failed' FROM sessions s WHERE s.id = j.session_id AND s.user_id = $1
     AND j.session_id = $2 AND j.operation = $3 AND j.revision = $4 AND j.attempt_token = $5 AND j.status = 'pending'`,
    [userId, sessionId, claim.operation, claim.revision, claim.attemptToken],
  );
}
export async function getSavedDebrief(userId: string, sessionId: string, attemptId?: string): Promise<{ attemptId: string; gaps: Gap[] }> {
  const client = await getDatabase().connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await ownedSession(client, userId, sessionId);
    const attempt = await readAttempt(client, sessionId, undefined, attemptId);
    if (!attempt) throw new ServiceError(404, "ATTEMPT_NOT_FOUND", "Complete a practice exam to see the review.");
    if (attempt.gaps === null) throw new ServiceError(409, "DEBRIEF_UNAVAILABLE", "This older attempt has no saved review. Teach more and run a new practice exam.");
    await client.query("COMMIT");
    return { attemptId: attempt.id, gaps: attempt.gaps };
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
