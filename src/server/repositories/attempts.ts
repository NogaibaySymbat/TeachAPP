import "server-only";
import type { ExamResult } from "@/lib/types";
import { getDatabase } from "../db";
import { findSession } from "./sessions";

export async function getLatestAttempt(userId: string, sessionId: string): Promise<ExamResult | null> {
  await findSession(userId, sessionId);
  const database = getDatabase();
  const attempt = await database.query<{ id: string; score: number; total: number }>(
    `SELECT a.id, a.score, a.total FROM exam_attempts a
     JOIN sessions s ON s.id = a.session_id
     WHERE s.id = $1 AND s.user_id = $2 ORDER BY a.created_at DESC, a.id DESC LIMIT 1`, [sessionId, userId],
  );
  if (!attempt.rows[0]) return null;
  const { id, score, total } = attempt.rows[0];
  const answers = await database.query<{
    question_id: string; answer: string | null; correct: boolean; guessed: boolean; reasoning: string; notebook_refs: string[];
  }>(`SELECT e.question_id, e.answer, e.correct, e.guessed, e.reasoning, e.notebook_refs
      FROM exam_answers e JOIN exam_attempts a ON a.id = e.attempt_id
      JOIN sessions s ON s.id = a.session_id
      WHERE a.id = $1 AND s.id = $2 AND s.user_id = $3 ORDER BY e.question_id`, [id, sessionId, userId]);
  return { score, total, results: answers.rows.map((row) => ({
    questionId: row.question_id, answer: row.answer, correct: row.correct, guessed: row.guessed,
    reasoning: row.reasoning, notebookRefs: row.notebook_refs,
  })) };
}
