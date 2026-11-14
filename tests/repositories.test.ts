import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../src/server/db", () => ({ getDatabase: () => database }));

import { createSession, findSession } from "../src/server/repositories/sessions";
import { getMessages, saveMessage } from "../src/server/repositories/messages";
import { getNotebook } from "../src/server/repositories/notebook";
import { getLatestAttempt } from "../src/server/repositories/attempts";
import { getStreak } from "../src/server/repositories/progress";

const database = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
const owner = randomUUID();
const stranger = randomUUID();

describe.skipIf(!process.env.TEST_DATABASE_URL)("Postgres repositories (isolated test database)", () => {
  beforeAll(async () => {
    await database.query(await readFile(new URL("../db/schema.sql", import.meta.url), "utf8"));
  });

  afterAll(async () => {
    await database.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [[owner, stranger]]);
    await database.end();
  });

  it("persists a session and an explanation, and derives the activity streak", async () => {
    const session = await createSession(owner, "integration-test");
    expect(await findSession(owner, session.id)).toEqual(session);
    expect(await getMessages(owner, session.id)).toEqual([]);
    const message = await saveMessage(owner, session.id, "An explanation used only for integration testing.");
    expect(await getMessages(owner, session.id)).toEqual([message]);
    expect(await getNotebook(owner, session.id)).toEqual([]);
    expect(await getLatestAttempt(owner, session.id)).toBeNull();
    expect(await getStreak(owner)).toBe(1);
  });

  it("denies another anonymous user access to every session repository", async () => {
    const session = await createSession(owner, "integration-test");
    for (const operation of [
      () => findSession(stranger, session.id),
      () => getMessages(stranger, session.id),
      () => saveMessage(stranger, session.id, "Unauthorized message"),
      () => getNotebook(stranger, session.id),
      () => getLatestAttempt(stranger, session.id),
    ]) {
      await expect(operation()).rejects.toMatchObject({ status: 404, code: "SESSION_NOT_FOUND" });
    }
    expect(await getMessages(owner, session.id)).toEqual([]);
  });

  it("prevents notebook entries from citing a message from a different session", async () => {
    const first = await createSession(owner, "integration-test");
    const second = await createSession(owner, "integration-test");
    const message = await saveMessage(owner, first.id, "A source in the first session.");
    await expect(database.query(
      "INSERT INTO notebook_entries (session_id, claim, source_message_id) VALUES ($1, $2, $3)",
      [second.id, "An invalid cross-session claim", message.id],
    )).rejects.toMatchObject({ code: "23503" });
  });
});
