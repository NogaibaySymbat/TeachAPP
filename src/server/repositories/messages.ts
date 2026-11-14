import "server-only";
import type { Message } from "@/lib/types";
import { getDatabase } from "../db";
import { ServiceError } from "../errors";
import { findSession } from "./sessions";

export interface MessageRow { id: string; role: Message["role"]; text: string; created_at: Date; reply_to_message_id: string | null }
export function serializeMessage(row: MessageRow): Message {
  return {
    id: row.id, role: row.role, text: row.text, createdAt: row.created_at.toISOString(),
    ...(row.reply_to_message_id ? { replyToMessageId: row.reply_to_message_id } : {}),
  };
}

export async function getMessages(userId: string, sessionId: string): Promise<Message[]> {
  await findSession(userId, sessionId);
  const result = await getDatabase().query<MessageRow>(
    `SELECT m.id, m.role, m.text, m.created_at, m.reply_to_message_id FROM messages m
     JOIN sessions s ON s.id = m.session_id
     WHERE s.id = $1 AND s.user_id = $2 ORDER BY m.created_at, m.id`, [sessionId, userId],
  );
  return result.rows.map(serializeMessage);
}

export async function saveMessage(userId: string, sessionId: string, text: string): Promise<Message> {
  const client = await getDatabase().connect();
  try {
    await client.query("BEGIN");
    const session = await client.query(
      "SELECT id FROM sessions WHERE id = $1 AND user_id = $2 FOR UPDATE", [sessionId, userId],
    );
    if (!session.rowCount) throw new ServiceError(404, "SESSION_NOT_FOUND", "This session could not be found for this user.");
    // A separate statement after the lock sees a claim that committed while
    // this save was waiting. A single CTE could use an earlier snapshot.
    const pending = await client.query(
      `SELECT 1 FROM student_reply_jobs WHERE session_id = $1
       AND status = 'pending' AND lease_until > clock_timestamp()`, [sessionId],
    );
    if (pending.rowCount) {
      throw new ServiceError(409, "AI_REPLY_PENDING", "Your student is still replying. Please wait before sending another explanation.");
    }
    const result = await client.query<MessageRow>(
      `INSERT INTO messages (session_id, role, text, created_at) VALUES ($1, 'user', $2, clock_timestamp())
       RETURNING id, role, text, created_at, reply_to_message_id`, [sessionId, text],
    );
    await client.query("COMMIT");
    return serializeMessage(result.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}
