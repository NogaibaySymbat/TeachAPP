import "server-only";
import { randomUUID } from "node:crypto";
import { getDatabase } from "../db";
import { ServiceError } from "../errors";

interface UserRow { id: string; auth_subject: string | null; claimed_by: string | null; demo_username: string | null }

// The caller must verify this subject with the authentication provider first.
export async function getOrCreateAccount(authSubject: string): Promise<string> {
  const result = await getDatabase().query<{ id: string }>(
    `INSERT INTO users (id, auth_subject) VALUES ($1, $2)
     ON CONFLICT (auth_subject) DO UPDATE SET auth_subject = EXCLUDED.auth_subject
     RETURNING id`,
    [randomUUID(), authSubject],
  );
  return result.rows[0].id;
}

export async function getOrCreateDemoAccount(): Promise<string> {
  const result = await getDatabase().query<{ id: string }>(
    `INSERT INTO users (id, demo_username) VALUES ($1, 'admin')
     ON CONFLICT (demo_username) DO UPDATE SET demo_username = EXCLUDED.demo_username
     RETURNING id`, [randomUUID()],
  );
  return result.rows[0].id;
}

export async function findDemoAccount(id: string): Promise<boolean> {
  const result = await getDatabase().query(
    "SELECT id FROM users WHERE id = $1 AND demo_username = 'admin' AND auth_subject IS NULL AND claimed_by IS NULL", [id],
  );
  return result.rowCount === 1;
}

export async function resolveGuestId(guestId: string): Promise<string> {
  const result = await getDatabase().query<UserRow>(
    "SELECT id, auth_subject, claimed_by, demo_username FROM users WHERE id = $1", [guestId],
  );
  const user = result.rows[0];
  if (user?.auth_subject || user?.claimed_by || user?.demo_username) {
    throw new ServiceError(401, "SIGN_IN_REQUIRED", "Sign in to access this saved history.");
  }
  return guestId;
}

export async function claimGuestHistory(accountId: string, guestId: string): Promise<{ claimed: boolean }> {
  if (accountId.toLowerCase() === guestId.toLowerCase()) {
    throw new ServiceError(409, "GUEST_HISTORY_UNAVAILABLE", "An account cannot be imported as guest history.");
  }
  const client = await getDatabase().connect();
  try {
    await client.query("BEGIN");
    // Consume even an unused browser ID. The unique insert also waits for an
    // in-flight first createSession, so it cannot appear after a successful claim.
    await client.query("INSERT INTO users (id) VALUES ($1) ON CONFLICT DO NOTHING", [guestId]);
    // All claim operations lock users in the same order, including two accounts
    // racing to claim one guest. createSession takes the same guest row lock.
    const result = await client.query<UserRow>(
      `SELECT id, auth_subject, claimed_by, demo_username FROM users
       WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE`, [[accountId, guestId]],
    );
    const account = result.rows.find((row) => row.id === accountId.toLowerCase());
    const guest = result.rows.find((row) => row.id === guestId.toLowerCase());
    if (account?.demo_username) {
      throw new ServiceError(403, "DEMO_HISTORY_IMPORT_DISABLED", "Личная гостевая история не переносится в общий тестовый аккаунт.");
    }
    if (!account?.auth_subject || account.claimed_by) {
      throw new ServiceError(401, "AUTH_REQUIRED", "Sign in before importing guest history.");
    }
    if (!guest) {
      throw new ServiceError(409, "GUEST_HISTORY_UNAVAILABLE", "This guest history is no longer available.");
    }
    if (guest.auth_subject || guest.demo_username || (guest.claimed_by && guest.claimed_by !== account.id)) {
      throw new ServiceError(409, "GUEST_HISTORY_UNAVAILABLE", "This guest history is already associated with an account.");
    }
    if (guest.claimed_by === account.id) {
      await client.query("COMMIT");
      return { claimed: true };
    }

    await client.query("UPDATE sessions SET user_id = $1 WHERE user_id = $2", [account.id, guest.id]);
    await client.query(
      `INSERT INTO topic_progress (user_id, topic_id, status, best_score, last_session_at)
       SELECT $1, topic_id, status, best_score, last_session_at FROM topic_progress WHERE user_id = $2
       ON CONFLICT (user_id, topic_id) DO UPDATE SET
         status = CASE
           WHEN topic_progress.status = 'passed' OR EXCLUDED.status = 'passed' THEN 'passed'
           WHEN topic_progress.status = 'failed' OR EXCLUDED.status = 'failed' THEN 'failed'
           ELSE 'not_started'
         END,
         best_score = GREATEST(topic_progress.best_score, EXCLUDED.best_score),
         last_session_at = GREATEST(topic_progress.last_session_at, EXCLUDED.last_session_at)`,
      [account.id, guest.id],
    );
    await client.query("DELETE FROM topic_progress WHERE user_id = $1", [guest.id]);
    // Keep this row as a tombstone so the old browser identifier cannot be reused.
    await client.query("UPDATE users SET claimed_by = $1 WHERE id = $2", [account.id, guest.id]);
    await client.query("COMMIT");
    return { claimed: true };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}
