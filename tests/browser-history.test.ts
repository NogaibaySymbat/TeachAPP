import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../src/server/db", () => ({ getDatabase: () => database }));
import { GET as historyGet } from "../src/app/api/sessions/route";
import { GET as sessionGet } from "../src/app/api/sessions/[id]/route";
import { POST as notebookPost } from "../src/app/api/sessions/[id]/notebook/route";
import { POST as examPost } from "../src/app/api/sessions/[id]/exam/route";
import { POST as replyPost } from "../src/app/api/sessions/[id]/reply/route";
import { createSession } from "../src/server/repositories/sessions";
import { saveMessage } from "../src/server/repositories/messages";

const database = new Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 5 });
const users = [randomUUID(), randomUUID(), randomUUID()];
const origin = "https://teach.test";
function request(userId: string, route: string, body?: unknown) {
  return new Request(origin + route, {
    method: body === undefined ? "GET" : "POST",
    headers: { "x-anonymous-id": userId, origin, "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

describe.skipIf(!process.env.TEST_DATABASE_URL)("browser history and guest ownership", () => {
  beforeAll(async () => { await database.query(await readFile(new URL("../db/schema.sql", import.meta.url), "utf8")); });
  afterAll(async () => { await database.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [users]); await database.end(); });

  it("reopens history without login and isolates another browser from reads and AI writes", async () => {
    const session = await createSession(users[0], "stakeholders-demo");
    const message = await saveMessage(users[0], session.id, "Only my browser should see this explanation.");
    const own = await historyGet(request(users[0], "/api/sessions"));
    expect(own.status).toBe(200);
    expect((await own.json()).sessions.map((s: { id: string }) => s.id)).toContain(session.id);
    const again = await historyGet(request(users[0], "/api/sessions"));
    expect((await again.json()).sessions.map((s: { id: string }) => s.id)).toContain(session.id);
    const other = await historyGet(request(users[1], "/api/sessions"));
    expect(await other.json()).toMatchObject({ sessions: [] });
    const context = { params: Promise.resolve({ id: session.id }) };
    expect((await sessionGet(request(users[1], `/api/sessions/${session.id}`), context)).status).toBe(404);
    for (const handler of [notebookPost, examPost]) {
      expect((await handler(request(users[1], `/api/sessions/${session.id}`, {}), context)).status).toBe(404);
    }
    expect((await replyPost(request(users[1], `/api/sessions/${session.id}/reply`, { messageId: message.id }), context)).status).toBe(404);
    // Empty teaching exercises the full guest workflow without a paid call.
    const empty = await createSession(users[0], "stakeholders-demo");
    const emptyContext = { params: Promise.resolve({ id: empty.id }) };
    expect((await notebookPost(request(users[0], `/api/sessions/${empty.id}/notebook`, {}), emptyContext)).status).toBe(200);
    const exam = await examPost(request(users[0], `/api/sessions/${empty.id}/exam`, {}), emptyContext);
    expect(exam.status).toBe(200);
    expect(await exam.json()).toMatchObject({ attempt: { score: 0, total: 3 } });
  });

  it("does not expose a legacy account by putting its UUID in the browser header", async () => {
    await database.query("INSERT INTO users (id, auth_subject) VALUES ($1, $2)", [users[2], randomUUID()]);
    await createSession(users[2], "stakeholders-demo");
    const response = await historyGet(request(users[2], "/api/sessions"));
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: { code: "SIGN_IN_REQUIRED" } });
  });
});
