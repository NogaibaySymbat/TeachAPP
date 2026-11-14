import "server-only";
import type { Message } from "@/lib/types";
import { getDatabase } from "../db";
import { ServiceError } from "../errors";
import { findSession } from "./sessions";

interface MessageRow { id: string; role: Message["role"]; text: string; created_at: Date }
function serialize(row: MessageRow): Message {
  return { id: row.id, role: row.role, text: row.text, createdAt: row.created_at.toISOString() };
}

export async function getMessages(userId: string, sessionId: string): Promise<Message[]> {
  await findSession(userId, sessionId);
  const result = await getDatabase().query<MessageRow>(
    `SELECT m.id, m.role, m.text, m.created_at FROM messages m
     JOIN sessions s ON s.id = m.session_id
     WHERE s.id = $1 AND s.user_id = $2 ORDER BY m.created_at, m.id`, [sessionId, userId],
  );
  return result.rows.map(serialize);
}

export async function saveMessage(userId: string, sessionId: string, text: string): Promise<Message> {
  const result = await getDatabase().query<MessageRow>(
    `WITH owned_session AS (
       SELECT id FROM sessions WHERE id = $1 AND user_id = $2 FOR UPDATE
     )
     INSERT INTO messages (session_id, role, text)
     SELECT id, 'user', $3 FROM owned_session
     RETURNING id, role, text, created_at`, [sessionId, userId, text],
  );
  if (!result.rows[0]) throw new ServiceError(404, "SESSION_NOT_FOUND", "This session could not be found for this user.");
  return serialize(result.rows[0]);
}
