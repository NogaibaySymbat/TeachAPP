import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../src/server/db", () => ({ getDatabase: () => database }));

import { claimGuestHistory, getOrCreateAccount, resolveGuestId } from "../src/server/repositories/accounts";
import { createSession, findSession, listSessions } from "../src/server/repositories/sessions";
import { getMessages, saveMessage } from "../src/server/repositories/messages";
import { getNotebook } from "../src/server/repositories/notebook";
import { getLatestAttempt } from "../src/server/repositories/attempts";
import { getStreak } from "../src/server/repositories/progress";

const database = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
const createdUsers = new Set<string>();

function newGuest(): string {
  const id = randomUUID();
  createdUsers.add(id);
  return id;
}

async function newAccount(): Promise<string> {
  const id = await getOrCreateAccount(randomUUID());
  createdUsers.add(id);
  return id;
}

describe.skipIf(!process.env.TEST_DATABASE_URL)("Account ownership (isolated test database)", () => {
  beforeAll(async () => {
    await database.query(await readFile(new URL("../db/schema.sql", import.meta.url), "utf8"));
  });

  afterAll(async () => {
    // Include account rows and their guest tombstones in one statement.
    await database.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [[...createdUsers]]);
    await database.end();
  });

  it("enables RLS without client policies on every application table", async () => {
    const tables = ["users", "sessions", "messages", "notebook_entries", "exam_attempts", "exam_answers", "topic_progress"];
    const security = await database.query<{ relname: string; relrowsecurity: boolean; policy_count: number }>(
      `SELECT c.relname, c.relrowsecurity, count(p.oid)::integer AS policy_count
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       LEFT JOIN pg_policy p ON p.polrelid = c.oid
       WHERE n.nspname = current_schema() AND c.relname = ANY($1::text[])
       GROUP BY c.relname, c.relrowsecurity ORDER BY c.relname`, [tables],
    );
    expect(security.rows).toEqual(tables.sort().map((relname) => ({ relname, relrowsecurity: true, policy_count: 0 })));
  });

  it("blocks direct reads and writes by a non-owner role even with table grants", async (context) => {
    const permission = await database.query<{ can_create_role: boolean }>(
      "SELECT rolsuper OR rolcreaterole AS can_create_role FROM pg_roles WHERE rolname = current_user",
    );
    if (!permission.rows[0].can_create_role) {
      // The preceding catalog test still checks RLS on restricted test databases.
      context.skip();
      return;
    }
    const guest = newGuest();
    const session = await createSession(guest, "direct-client-security");
    const message = await saveMessage(guest, session.id, "Private session content.");
    const roleName = `teachapp_rls_${randomUUID().replaceAll("-", "")}`;
    const tables = ["users", "sessions", "messages", "notebook_entries", "exam_attempts", "exam_answers", "topic_progress"];
    const writableFields = ["created_at", "topic_id", "text", "claim", "score", "answer", "status"];
    const client = await database.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "INSERT INTO notebook_entries (session_id, claim, source_message_id) VALUES ($1, 'Private claim', $2)",
        [session.id, message.id],
      );
      const attempt = await client.query<{ id: string }>(
        "INSERT INTO exam_attempts (session_id, score, total) VALUES ($1, 0, 1) RETURNING id", [session.id],
      );
      await client.query(
        `INSERT INTO exam_answers (attempt_id, question_id, answer, correct, guessed, reasoning)
         VALUES ($1, 'private-question', NULL, false, true, 'Private answer reasoning')`, [attempt.rows[0].id],
      );
      // This role and all grants exist only within this rolled-back transaction.
      await client.query(`CREATE ROLE "${roleName}" NOLOGIN NOSUPERUSER NOBYPASSRLS`);
      await client.query(`GRANT "${roleName}" TO CURRENT_USER`);
      await client.query(`GRANT USAGE ON SCHEMA public TO "${roleName}"`);
      await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ${tables.join(", ")} TO "${roleName}"`);
      for (const table of tables) {
        expect((await client.query(`SELECT 1 FROM ${table} LIMIT 1`)).rowCount).toBe(1);
      }
      await client.query(`SET LOCAL ROLE "${roleName}"`);
      for (const [index, table] of tables.entries()) {
        expect((await client.query(`SELECT * FROM ${table}`)).rows).toEqual([]);
        expect((await client.query(`UPDATE ${table} SET ${writableFields[index]} = ${writableFields[index]}`)).rowCount).toBe(0);
        expect((await client.query(`DELETE FROM ${table}`)).rowCount).toBe(0);
      }
      await expect(client.query("INSERT INTO users (id) VALUES ($1)", [randomUUID()])).rejects.toMatchObject({ code: "42501" });
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
    expect(await getMessages(guest, session.id)).toEqual([message]);
  });

  it("maps one verified subject to one separate account, including simultaneous first sign-ins", async () => {
    const subject = randomUUID();
    const accountIds = await Promise.all(Array.from({ length: 5 }, () => getOrCreateAccount(subject)));
    for (const id of accountIds) createdUsers.add(id);
    expect(new Set(accountIds).size).toBe(1);
    expect(accountIds[0]).not.toBe(subject);
    await expect(resolveGuestId(accountIds[0])).rejects.toMatchObject({ status: 401, code: "SIGN_IN_REQUIRED" });
    const guest = newGuest();
    expect(await resolveGuestId(guest)).toBe(guest);
  });

  it("never exposes a demo account through a guest ID or imports private history into it", async () => {
    const demo = newGuest();
    await database.query("INSERT INTO users (id, demo_username) VALUES ($1, $2)", [demo, `demo-test-${demo}`]);
    const guest = newGuest();
    const account = await newAccount();
    const session = await createSession(guest, "private-before-demo");
    await expect(resolveGuestId(demo)).rejects.toMatchObject({ status: 401, code: "SIGN_IN_REQUIRED" });
    await expect(claimGuestHistory(demo, guest)).rejects.toMatchObject({ status: 403, code: "DEMO_HISTORY_IMPORT_DISABLED" });
    await expect(claimGuestHistory(account, demo)).rejects.toMatchObject({ status: 409, code: "GUEST_HISTORY_UNAVAILABLE" });
    expect(await findSession(guest, session.id)).toEqual(session);
    expect((await database.query("SELECT claimed_by FROM users WHERE id = $1", [guest])).rows[0].claimed_by).toBeNull();
  });

  it("transfers the complete session and activity, retires the guest ID, and makes retries harmless", async () => {
    const guest = newGuest();
    const account = await newAccount();
    const session = await createSession(guest, "claim-transfer");
    const message = await saveMessage(guest, session.id, "The source explanation belongs to this guest.");
    const notebook = await database.query<{ id: string }>(
      "INSERT INTO notebook_entries (session_id, claim, source_message_id) VALUES ($1, $2, $3) RETURNING id",
      [session.id, "A sourced claim", message.id],
    );
    const entryId = notebook.rows[0].id;
    const attempt = await database.query<{ id: string }>(
      "INSERT INTO exam_attempts (session_id, score, total) VALUES ($1, 1, 1) RETURNING id", [session.id],
    );
    await database.query(
      `INSERT INTO exam_answers (attempt_id, question_id, answer, correct, guessed, reasoning, notebook_refs)
       VALUES ($1, 'claim-question', 'A', true, false, 'Based on the saved notebook.', $2::uuid[])`,
      [attempt.rows[0].id, [entryId]],
    );

    expect(await claimGuestHistory(account, guest)).toEqual({ claimed: true });
    expect(await claimGuestHistory(account, guest)).toEqual({ claimed: true });
    expect(await findSession(account, session.id)).toEqual(session);
    expect(await getMessages(account, session.id)).toEqual([message]);
    expect(await getNotebook(account, session.id)).toEqual([{ id: entryId, claim: "A sourced claim", sourceMessageId: message.id }]);
    expect(await getLatestAttempt(account, session.id)).toEqual({
      score: 1, total: 1,
      results: [{ questionId: "claim-question", answer: "A", correct: true, guessed: false,
        reasoning: "Based on the saved notebook.", notebookRefs: [entryId] }],
    });
    expect(await getStreak(account)).toBe(1);
    expect((await listSessions(account)).sessions[0]).toMatchObject({
      id: session.id, messageCount: 1, latestAttempt: { score: 1, total: 1 },
    });
    expect(await getStreak(guest)).toBe(0);
    expect((await listSessions(guest)).sessions).toEqual([]);
    for (const operation of [
      () => findSession(guest, session.id),
      () => getMessages(guest, session.id),
      () => saveMessage(guest, session.id, "An old browser cannot write after claim."),
      () => getNotebook(guest, session.id),
      () => getLatestAttempt(guest, session.id),
    ]) {
      await expect(operation()).rejects.toMatchObject({ status: 404, code: "SESSION_NOT_FOUND" });
    }
    await expect(resolveGuestId(guest)).rejects.toMatchObject({ status: 401, code: "SIGN_IN_REQUIRED" });
    await expect(createSession(guest, "retired-guest")).rejects.toMatchObject({ status: 401, code: "SIGN_IN_REQUIRED" });
    expect((await database.query("SELECT claimed_by FROM users WHERE id = $1", [guest])).rows[0].claimed_by).toBe(account);
  });

  it("merges progress without losing a pass, a better score, or a newer activity date", async () => {
    const guest = newGuest();
    const account = await newAccount();
    await database.query("INSERT INTO users (id) VALUES ($1)", [guest]);
    await database.query(
      `INSERT INTO topic_progress (user_id, topic_id, status, best_score, last_session_at) VALUES
       ($1, 'keep-account-pass', 'passed', 8, '2026-01-03T00:00:00Z'),
       ($2, 'keep-account-pass', 'failed', 9, '2026-01-01T00:00:00Z'),
       ($1, 'keep-guest-pass', 'failed', 9, '2026-01-01T00:00:00Z'),
       ($2, 'keep-guest-pass', 'passed', 8, '2026-01-04T00:00:00Z'),
       ($1, 'keep-failure', 'not_started', NULL, NULL),
       ($2, 'keep-failure', 'failed', 0, '2026-01-02T00:00:00Z'),
       ($1, 'account-only', 'not_started', NULL, NULL),
       ($2, 'guest-only', 'not_started', NULL, NULL)`, [account, guest],
    );
    await claimGuestHistory(account, guest);
    const progress = await database.query("SELECT topic_id, status, best_score, last_session_at FROM topic_progress WHERE user_id = $1 ORDER BY topic_id", [account]);
    expect(progress.rows).toEqual([
      { topic_id: "account-only", status: "not_started", best_score: null, last_session_at: null },
      { topic_id: "guest-only", status: "not_started", best_score: null, last_session_at: null },
      { topic_id: "keep-account-pass", status: "passed", best_score: 9, last_session_at: new Date("2026-01-03T00:00:00Z") },
      { topic_id: "keep-failure", status: "failed", best_score: 0, last_session_at: new Date("2026-01-02T00:00:00Z") },
      { topic_id: "keep-guest-pass", status: "passed", best_score: 9, last_session_at: new Date("2026-01-04T00:00:00Z") },
    ]);
    expect((await database.query("SELECT * FROM topic_progress WHERE user_id = $1", [guest])).rows).toEqual([]);
  });

  it("rejects account imports, unverified destinations, and a second account reclaiming history", async () => {
    const guest = newGuest();
    const first = await newAccount();
    const second = await newAccount();
    const session = await createSession(guest, "claim-boundaries");
    const emptyGuest = newGuest();
    expect(await claimGuestHistory(first, emptyGuest)).toEqual({ claimed: true });
    expect(await claimGuestHistory(first, emptyGuest)).toEqual({ claimed: true });
    await expect(resolveGuestId(emptyGuest)).rejects.toMatchObject({ status: 401, code: "SIGN_IN_REQUIRED" });
    await expect(createSession(emptyGuest, "after-empty-claim")).rejects.toMatchObject({ status: 401, code: "SIGN_IN_REQUIRED" });
    await expect(claimGuestHistory(guest, newGuest())).rejects.toMatchObject({ status: 401, code: "AUTH_REQUIRED" });
    await expect(claimGuestHistory(first, first)).rejects.toMatchObject({ status: 409 });
    await expect(claimGuestHistory(first, second)).rejects.toMatchObject({ status: 409 });
    await claimGuestHistory(first, guest);
    await expect(claimGuestHistory(second, guest)).rejects.toMatchObject({ status: 409, code: "GUEST_HISTORY_UNAVAILABLE" });
    expect(await findSession(first, session.id)).toEqual(session);
    await expect(findSession(second, session.id)).rejects.toMatchObject({ status: 404 });
  });

  it("paginates only the owner's history in descending activity order", async () => {
    const owner = await newAccount();
    const stranger = newGuest();
    const sessions = [];
    for (let index = 0; index < 5; index += 1) {
      const session = await createSession(owner, `history-${index}`);
      await database.query("UPDATE sessions SET started_at = $2 WHERE id = $1", [session.id, new Date(`2026-01-0${index + 1}T00:00:00Z`)]);
      sessions.push(session);
    }
    await createSession(stranger, "private-history");
    const message = await saveMessage(owner, sessions[0].id, "Recent activity puts the oldest session first.");
    const firstPage = await listSessions(owner, 0, 2);
    expect(firstPage.sessions.map(({ id }) => id)).toEqual([sessions[0].id, sessions[4].id]);
    expect(firstPage.sessions[0]).toMatchObject({ messageCount: 1, lastActivityAt: message.createdAt, latestAttempt: null });
    expect(firstPage.nextOffset).toBe(2);
    const secondPage = await listSessions(owner, firstPage.nextOffset!, 2);
    expect(secondPage.sessions.map(({ id }) => id)).toEqual([sessions[3].id, sessions[2].id]);
    expect(secondPage.nextOffset).toBe(4);
    const lastPage = await listSessions(owner, secondPage.nextOffset!, 2);
    expect(lastPage.sessions.map(({ id }) => id)).toEqual([sessions[1].id]);
    expect(lastPage.nextOffset).toBeNull();
    expect((await listSessions(owner, 100, 2)).sessions).toEqual([]);
    expect((await listSessions(stranger)).sessions).toHaveLength(1);
  });

  it("keeps concurrent new sessions attached to the account or rejects the retired guest", async () => {
    for (let index = 0; index < 6; index += 1) {
      const guest = newGuest();
      const account = await newAccount();
      await createSession(guest, "before-claim");
      const [claim, creation] = await Promise.allSettled([
        claimGuestHistory(account, guest), createSession(guest, "during-claim"),
      ]);
      expect(claim.status).toBe("fulfilled");
      if (creation.status === "fulfilled") {
        expect(await findSession(account, creation.value.id)).toEqual(creation.value);
      } else {
        expect(creation.reason).toMatchObject({ status: 401, code: "SIGN_IN_REQUIRED" });
      }
      expect((await listSessions(guest)).sessions).toEqual([]);
    }
  });

  it("allows only one account to win a concurrent claim", async () => {
    const guest = newGuest();
    const first = await newAccount();
    const second = await newAccount();
    const session = await createSession(guest, "racing-accounts");
    const results = await Promise.allSettled([claimGuestHistory(first, guest), claimGuestHistory(second, guest)]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejection = results.find((result) => result.status === "rejected");
    expect(rejection?.status === "rejected" && rejection.reason).toMatchObject({ status: 409 });
    const winner = results[0].status === "fulfilled" ? first : second;
    expect(await findSession(winner, session.id)).toEqual(session);
  });

  it("consumes a previously unused guest ID while its first session races the claim", async () => {
    for (let index = 0; index < 6; index += 1) {
      const guest = newGuest();
      const account = await newAccount();
      const [claim, creation] = await Promise.allSettled([
        claimGuestHistory(account, guest), createSession(guest, "first-session-during-claim"),
      ]);
      expect(claim).toEqual({ status: "fulfilled", value: { claimed: true } });
      if (creation.status === "fulfilled") {
        expect(await findSession(account, creation.value.id)).toEqual(creation.value);
      } else {
        expect(creation.reason).toMatchObject({ status: 401, code: "SIGN_IN_REQUIRED" });
      }
      await expect(resolveGuestId(guest)).rejects.toMatchObject({ status: 401, code: "SIGN_IN_REQUIRED" });
      expect((await listSessions(guest)).sessions).toEqual([]);
    }
  });

  it("serializes guest message writes with a concurrent history transfer", async () => {
    const guest = newGuest();
    const account = await newAccount();
    const session = await createSession(guest, "racing-message");
    const [claim, write] = await Promise.allSettled([
      claimGuestHistory(account, guest), saveMessage(guest, session.id, "A message sent while signing in."),
    ]);
    expect(claim.status).toBe("fulfilled");
    if (write.status === "fulfilled") {
      expect(await getMessages(account, session.id)).toEqual([write.value]);
    } else {
      expect(write.reason).toMatchObject({ status: 404, code: "SESSION_NOT_FOUND" });
      expect(await getMessages(account, session.id)).toEqual([]);
    }
    await expect(saveMessage(guest, session.id, "Too late.")).rejects.toMatchObject({ status: 404 });
  });
});
