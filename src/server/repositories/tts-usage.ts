import "server-only";
import { getDatabase } from "@/server/db";
import { ServiceError } from "@/server/errors";
import { MAX_SYNTHESES_PER_MESSAGE, usageMonth, type TtsProviderId } from "@/server/tts/config";

interface TtsReservation {
  provider: TtsProviderId;
  messageId: string;
  characters: number;
  monthlyCharacterCap: number;
  now?: Date;
}

// Reserves characters before calling the provider. Reservations are never
// released, even when the provider fails, so the cap stays conservative.
export async function reserveTtsCharacters({ provider, messageId, characters, monthlyCharacterCap, now }: TtsReservation): Promise<string> {
  if (!Number.isSafeInteger(characters) || characters < 1) {
    throw new ServiceError(400, "TTS_EMPTY_TEXT", "There is nothing to read aloud.");
  }
  const month = usageMonth(now);
  const client = await getDatabase().connect();
  try {
    await client.query("BEGIN");
    // Serializes check-and-reserve per provider across processes, like the OpenAI ledger.
    await client.query("SELECT pg_advisory_xact_lock(163430, hashtext($1))", [provider]);
    const { rows } = await client.query<{ total: string; for_message: number }>(
      `SELECT COALESCE(SUM(characters), 0)::text AS total,
              COUNT(*) FILTER (WHERE message_id = $3)::int AS for_message
       FROM tts_usage WHERE provider = $1 AND usage_month = $2`,
      [provider, month, messageId],
    );
    if (rows[0].for_message >= MAX_SYNTHESES_PER_MESSAGE) {
      throw new ServiceError(429, "TTS_MESSAGE_LIMIT", "This reply has already been read aloud several times.");
    }
    if (Number(rows[0].total) + characters > monthlyCharacterCap) {
      throw new ServiceError(503, "TTS_LIMIT_REACHED", "The student's voice is paused for this month.");
    }
    const inserted = await client.query<{ id: string }>(
      "INSERT INTO tts_usage (provider, usage_month, message_id, characters) VALUES ($1, $2, $3, $4) RETURNING id",
      [provider, month, messageId, characters],
    );
    await client.query("COMMIT");
    return inserted.rows[0].id;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// Reads a student reply only if the session belongs to this user.
export async function findStudentMessageText(userId: string, sessionId: string, messageId: string): Promise<string> {
  const result = await getDatabase().query<{ text: string }>(
    `SELECT m.text FROM messages m JOIN sessions s ON s.id = m.session_id
     WHERE m.id = $1 AND m.session_id = $2 AND s.user_id = $3 AND m.role = 'student'`,
    [messageId, sessionId, userId],
  );
  if (!result.rowCount) throw new ServiceError(404, "MESSAGE_NOT_FOUND", "This reply could not be found.");
  return result.rows[0].text;
}
