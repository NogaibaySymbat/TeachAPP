import "server-only";
import type { NotebookEntry } from "@/lib/types";
import { getDatabase } from "../db";
import { findSession } from "./sessions";

export async function getNotebook(userId: string, sessionId: string): Promise<NotebookEntry[]> {
  await findSession(userId, sessionId);
  const result = await getDatabase().query<{ id: string; claim: string; source_message_id: string }>(
    `SELECT n.id, n.claim, n.source_message_id FROM notebook_entries n
     JOIN sessions s ON s.id = n.session_id
     WHERE s.id = $1 AND s.user_id = $2 ORDER BY n.id`, [sessionId, userId],
  );
  return result.rows.map((row) => ({ id: row.id, claim: row.claim, sourceMessageId: row.source_message_id }));
}
