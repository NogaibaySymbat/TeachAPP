import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../src/server/db", () => ({ getDatabase: () => database }));
const { completeStudentReply } = vi.hoisted(() => ({ completeStudentReply: vi.fn() }));
vi.mock("../src/ai/student", () => ({ completeStudentReply }));

import { createSession } from "../src/server/repositories/sessions";
import { getMessages, saveMessage } from "../src/server/repositories/messages";
import { claimStudentReply, failStudentReply, finishStudentReply } from "../src/server/repositories/student-replies";
import { replyToExplanation } from "../src/server/student-reply";

const database = new Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 5 });
const users: string[] = [];
async function setup() {
  const userId = randomUUID();
  users.push(userId);
  const session = await createSession(userId, "integration-test");
  const source = await saveMessage(userId, session.id, "A clear explanation.");
  return { userId, sessionId: session.id, source };
}
async function clearCooldown(userId: string) {
  await database.query("UPDATE users SET last_ai_reply_at = NULL WHERE id = $1", [userId]);
}

describe.skipIf(!process.env.TEST_DATABASE_URL)("durable student reply claims", () => {
  beforeAll(async () => {
    await database.query(await readFile(new URL("../db/schema.sql", import.meta.url), "utf8"));
  });
  afterAll(async () => {
    await database.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [users]);
    await database.end();
  });

  it("allows one concurrent claim and blocks new explanations while it is active", async () => {
    const { userId, sessionId, source } = await setup();
    const results = await Promise.allSettled([
      claimStudentReply(userId, sessionId, source.id), claimStudentReply(userId, sessionId, source.id),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected).toMatchObject({ status: "rejected", reason: { code: "AI_REPLY_PENDING" } });
    await expect(saveMessage(userId, sessionId, "Too soon")).rejects.toMatchObject({ code: "AI_REPLY_PENDING" });
    expect(await getMessages(userId, sessionId)).toEqual([source]);
  });

  it("returns the same persisted reply for repeated requests without calling the model again", async () => {
    const { userId, sessionId, source } = await setup();
    completeStudentReply.mockResolvedValueOnce("Could you give me an example?");
    const reply = await replyToExplanation(userId, sessionId, source.id);
    expect(reply.replyToMessageId).toBe(source.id);
    const called = completeStudentReply.mock.calls.length;
    expect(await replyToExplanation(userId, sessionId, source.id)).toEqual(reply);
    expect(completeStudentReply.mock.calls.length).toBe(called);
    expect(await getMessages(userId, sessionId)).toEqual([source, reply]);
  });

  it("keeps the saved explanation on provider failure and retries only generation", async () => {
    const { userId, sessionId, source } = await setup();
    completeStudentReply.mockRejectedValueOnce(new Error("Provider unavailable"));
    await expect(replyToExplanation(userId, sessionId, source.id)).rejects.toThrow("Provider unavailable");
    expect(await getMessages(userId, sessionId)).toEqual([source]);
    await clearCooldown(userId);
    completeStudentReply.mockResolvedValueOnce("What does that look like in practice?");
    await replyToExplanation(userId, sessionId, source.id);
    expect((await getMessages(userId, sessionId)).map((item) => item.role)).toEqual(["user", "student"]);
  });

  it("fences an expired worker after a manual retry takes its place", async () => {
    const { userId, sessionId, source } = await setup();
    const old = await claimStudentReply(userId, sessionId, source.id);
    if (old.kind !== "claimed") throw new Error("Expected a claim");
    await database.query("UPDATE student_reply_jobs SET lease_until = clock_timestamp() - interval '1 second' WHERE message_id = $1", [source.id]);
    await clearCooldown(userId);
    const current = await claimStudentReply(userId, sessionId, source.id);
    if (current.kind !== "claimed") throw new Error("Expected a new claim");
    await expect(finishStudentReply(userId, sessionId, source.id, old.attemptToken, "Late response")).rejects.toMatchObject({ code: "AI_REPLY_STALE" });
    await failStudentReply(sessionId, source.id, old.attemptToken);
    const reply = await finishStudentReply(userId, sessionId, source.id, current.attemptToken, "Current response");
    expect((await getMessages(userId, sessionId)).at(-1)).toEqual(reply);
  });

  it("checks ownership and latest-source identity before claiming work", async () => {
    const owner = await setup();
    const stranger = await setup();
    await expect(claimStudentReply(stranger.userId, owner.sessionId, owner.source.id)).rejects.toMatchObject({ status: 404 });
    await saveMessage(owner.userId, owner.sessionId, "A newer explanation.");
    await expect(claimStudentReply(owner.userId, owner.sessionId, owner.source.id)).rejects.toMatchObject({ code: "AI_EXPLANATION_CHANGED" });
    const jobs = await database.query("SELECT 1 FROM student_reply_jobs WHERE session_id = $1", [owner.sessionId]);
    expect(jobs.rowCount).toBe(0);
  });

  it("limits successive paid requests across an account's sessions", async () => {
    const { userId, sessionId, source } = await setup();
    await claimStudentReply(userId, sessionId, source.id);
    const another = await createSession(userId, "integration-test");
    const next = await saveMessage(userId, another.id, "Another session.");
    await expect(claimStudentReply(userId, another.id, next.id)).rejects.toMatchObject({ code: "AI_RATE_LIMIT" });
  });

  it("does not save stale replies when a new explanation appears after a lease expires", async () => {
    const { userId, sessionId, source } = await setup();
    const claim = await claimStudentReply(userId, sessionId, source.id);
    if (claim.kind !== "claimed") throw new Error("Expected a claim");
    await database.query("UPDATE student_reply_jobs SET lease_until = clock_timestamp() - interval '1 second' WHERE message_id = $1", [source.id]);
    await saveMessage(userId, sessionId, "A newer explanation after the timeout.");
    await expect(finishStudentReply(userId, sessionId, source.id, claim.attemptToken, "Late response")).rejects.toMatchObject({ code: "AI_REPLY_STALE" });
    expect((await getMessages(userId, sessionId)).every((item) => item.role === "user")).toBe(true);
  });
});
