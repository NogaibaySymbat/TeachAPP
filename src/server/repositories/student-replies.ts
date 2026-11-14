import "server-only";
import { randomUUID } from "node:crypto";
import type { Message } from "@/lib/types";
import { getDatabase } from "../db";
import { ServiceError } from "../errors";
import { serializeMessage, type MessageRow } from "./messages";

type ReplyClaim =
  | { kind: "completed"; message: Message }
  | { kind: "claimed"; attemptToken: string; topicId: string; history: Message[] };

const pendingError = () => new ServiceError(409, "AI_REPLY_PENDING", "Your student is already replying. Wait a moment, then try again.");
const staleError = () => new ServiceError(409, "AI_REPLY_STALE", "The conversation changed. Reload the session to see the latest messages.");

export async function claimStudentReply(userId: string, sessionId: string, messageId: string): Promise<ReplyClaim> {
  const client = await getDatabase().connect();
  try {
    await client.query("BEGIN");
    // Serialize an account's short claims, not the model requests themselves.
    const user = await client.query<{ limited: boolean }>(
      `SELECT last_ai_reply_at > clock_timestamp() - interval '3 seconds' AS limited
       FROM users WHERE id = $1 FOR UPDATE`, [userId],
    );
    const session = await client.query<{ topic_id: string }>(
      "SELECT topic_id FROM sessions WHERE id = $1 AND user_id = $2 FOR UPDATE", [sessionId, userId],
    );
    if (!session.rows[0]) throw new ServiceError(404, "SESSION_NOT_FOUND", "This session could not be found for this user.");

    const completed = await client.query<MessageRow>(
      `SELECT id, role, text, created_at, reply_to_message_id FROM messages
       WHERE session_id = $1 AND reply_to_message_id = $2`, [sessionId, messageId],
    );
    if (completed.rows[0]) {
      await client.query("COMMIT");
      return { kind: "completed", message: serializeMessage(completed.rows[0]) };
    }

    const latest = await client.query<{ id: string; text: string }>(
      `SELECT id, text FROM messages WHERE session_id = $1 AND role = 'user'
       ORDER BY created_at DESC, id DESC LIMIT 1`, [sessionId],
    );
    if (!latest.rows[0] || latest.rows[0].id !== messageId) {
      throw new ServiceError(409, "AI_EXPLANATION_CHANGED", "Ask for a reply to your latest saved explanation.");
    }
    if (latest.rows[0].text.length > 4000) {
      throw new ServiceError(400, "AI_EXPLANATION_TOO_LONG", "Your explanation is saved. Send a shorter explanation of up to 4,000 characters to get a student reply.");
    }
    const pending = await client.query(
      `SELECT 1 FROM student_reply_jobs WHERE session_id = $1
       AND status = 'pending' AND lease_until > clock_timestamp()`, [sessionId],
    );
    if (pending.rowCount) throw pendingError();
    if (user.rows[0]?.limited) {
      throw new ServiceError(429, "AI_RATE_LIMIT", "Please wait a few seconds before asking for another reply.");
    }
    const attemptToken = randomUUID();
    await client.query(
      `INSERT INTO student_reply_jobs (message_id, session_id, status, attempt_token, lease_until)
       VALUES ($1, $2, 'pending', $3, clock_timestamp() + interval '90 seconds')
       ON CONFLICT (message_id) DO UPDATE
       SET status = 'pending', attempt_token = EXCLUDED.attempt_token, lease_until = EXCLUDED.lease_until`,
      [messageId, sessionId, attemptToken],
    );
    await client.query("UPDATE users SET last_ai_reply_at = clock_timestamp() WHERE id = $1", [userId]);
    const history = await client.query<MessageRow>(
      `SELECT id, role, text, created_at, reply_to_message_id FROM messages WHERE session_id = $1
       ORDER BY created_at DESC, id DESC LIMIT 12`, [sessionId],
    );
    await client.query("COMMIT");
    return { kind: "claimed", attemptToken, topicId: session.rows[0].topic_id, history: history.rows.reverse().map(serializeMessage) };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

export async function finishStudentReply(
  userId: string, sessionId: string, messageId: string, attemptToken: string, text: string,
): Promise<Message> {
  if (!text.trim() || text.length > 10000) throw new ServiceError(502, "AI_INVALID_REPLY", "Your student could not produce a reply. Your explanation is saved.");
  const client = await getDatabase().connect();
  try {
    await client.query("BEGIN");
    const session = await client.query(
      "SELECT id FROM sessions WHERE id = $1 AND user_id = $2 FOR UPDATE", [sessionId, userId],
    );
    if (!session.rowCount) throw new ServiceError(404, "SESSION_NOT_FOUND", "This session could not be found for this user.");
    const claim = await client.query(
      `SELECT 1 FROM student_reply_jobs WHERE session_id = $1 AND message_id = $2
       AND attempt_token = $3 AND status = 'pending' AND lease_until > clock_timestamp() FOR UPDATE`,
      [sessionId, messageId, attemptToken],
    );
    if (!claim.rowCount) throw staleError();
    const latest = await client.query<{ id: string }>(
      "SELECT id FROM messages WHERE session_id = $1 AND role = 'user' ORDER BY created_at DESC, id DESC LIMIT 1", [sessionId],
    );
    if (latest.rows[0]?.id !== messageId) throw staleError();
    const result = await client.query<MessageRow>(
      `INSERT INTO messages (session_id, role, text, reply_to_message_id, created_at)
       VALUES ($1, 'student', $2, $3, clock_timestamp())
       RETURNING id, role, text, created_at, reply_to_message_id`, [sessionId, text.trim(), messageId],
    );
    await client.query(
      "UPDATE student_reply_jobs SET status = 'completed' WHERE message_id = $1 AND attempt_token = $2", [messageId, attemptToken],
    );
    await client.query("COMMIT");
    return serializeMessage(result.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

export async function failStudentReply(sessionId: string, messageId: string, attemptToken: string): Promise<void> {
  await getDatabase().query(
    `UPDATE student_reply_jobs SET status = 'failed'
     WHERE session_id = $1 AND message_id = $2 AND attempt_token = $3 AND status = 'pending'`,
    [sessionId, messageId, attemptToken],
  );
}
