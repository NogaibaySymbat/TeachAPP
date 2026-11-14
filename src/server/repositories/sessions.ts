import "server-only";
import type { Session } from "@/lib/types";
import { getDatabase } from "../db";
import { ServiceError } from "../errors";

interface SessionRow { id: string; topic_id: string; started_at: Date; finished_at: Date | null }
function serialize(row: SessionRow): Session {
  return { id: row.id, topicId: row.topic_id, startedAt: row.started_at.toISOString(), finishedAt: row.finished_at?.toISOString() ?? null };
}

export async function createSession(userId: string, topicId: string): Promise<Session> {
  const client = await getDatabase().connect();
  try {
    await client.query("BEGIN");
    await client.query("INSERT INTO users (id) VALUES ($1) ON CONFLICT DO NOTHING", [userId]);
    const user = await client.query<{ claimed_by: string | null }>(
      "SELECT claimed_by FROM users WHERE id = $1 FOR UPDATE", [userId],
    );
    if (user.rows[0]?.claimed_by) {
      throw new ServiceError(401, "SIGN_IN_REQUIRED", "Sign in to access this saved history.");
    }
    const result = await client.query<SessionRow>(
      "INSERT INTO sessions (user_id, topic_id) VALUES ($1, $2) RETURNING id, topic_id, started_at, finished_at", [userId, topicId],
    );
    await client.query(
      `INSERT INTO topic_progress (user_id, topic_id, last_session_at) VALUES ($1, $2, now())
       ON CONFLICT (user_id, topic_id) DO UPDATE SET last_session_at = EXCLUDED.last_session_at`, [userId, topicId],
    );
    await client.query("COMMIT");
    return serialize(result.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

export async function findSession(userId: string, id: string): Promise<Session> {
  const result = await getDatabase().query<SessionRow>(
    "SELECT id, topic_id, started_at, finished_at FROM sessions WHERE id = $1 AND user_id = $2", [id, userId],
  );
  if (!result.rows[0]) throw new ServiceError(404, "SESSION_NOT_FOUND", "This session could not be found for this user.");
  return serialize(result.rows[0]);
}

export async function listSessions(userId: string, offset = 0, limit = 20) {
  const result = await getDatabase().query<SessionRow & {
    last_activity_at: Date;
    message_count: number;
    score: number | null;
    total: number | null;
  }>(
    `SELECT s.id, s.topic_id, s.started_at, s.finished_at,
            GREATEST(s.started_at, m.last_message_at, a.created_at) AS last_activity_at,
            m.message_count, a.score, a.total
     FROM sessions s
     LEFT JOIN LATERAL (
       SELECT count(*)::integer AS message_count, max(created_at) AS last_message_at
       FROM messages WHERE session_id = s.id
     ) m ON true
     LEFT JOIN LATERAL (
       SELECT score, total, created_at FROM exam_attempts
       WHERE session_id = s.id ORDER BY created_at DESC, id DESC LIMIT 1
     ) a ON true
     WHERE s.user_id = $1
     ORDER BY last_activity_at DESC, s.id DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit + 1, offset],
  );
  return {
    sessions: result.rows.slice(0, limit).map((row) => ({
      ...serialize(row),
      lastActivityAt: row.last_activity_at.toISOString(),
      messageCount: row.message_count,
      latestAttempt: row.score !== null && row.total !== null ? { score: row.score, total: row.total } : null,
    })),
    nextOffset: result.rows.length > limit ? offset + limit : null,
  };
}
