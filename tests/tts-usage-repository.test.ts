import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../src/server/db", () => ({ getDatabase: () => database }));
const { synthesizeSpeech, synthesizeWithDeepgram } = vi.hoisted(() => ({ synthesizeSpeech: vi.fn(), synthesizeWithDeepgram: vi.fn() }));
vi.mock("../src/server/tts/google", () => ({ synthesizeSpeech }));
vi.mock("../src/server/tts/deepgram", () => ({ synthesizeWithDeepgram }));

import { createSession } from "../src/server/repositories/sessions";
import { findStudentMessageText, reserveTtsCharacters } from "../src/server/repositories/tts-usage";
import { speakStudentMessage } from "../src/server/student-speech";

const database = new Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 8 });
const users: string[] = [];
const messageIds: string[] = [];
// A month far in the future keeps these rows apart from any real usage.
const testMonth = new Date("2099-01-15T00:00:00Z");

async function studentMessage(text = "Can you give me an example?") {
  const userId = randomUUID();
  users.push(userId);
  const session = await createSession(userId, "integration-test");
  const { rows } = await database.query<{ id: string }>(
    "INSERT INTO messages (session_id, role, text) VALUES ($1, 'student', $2) RETURNING id", [session.id, text],
  );
  messageIds.push(rows[0].id);
  return { userId, sessionId: session.id, messageId: rows[0].id };
}

describe.skipIf(!process.env.TEST_DATABASE_URL)("text-to-speech character ledger", () => {
  beforeAll(async () => {
    await database.query(await readFile(new URL("../db/schema.sql", import.meta.url), "utf8"));
  });
  afterEach(() => { vi.unstubAllEnvs(); synthesizeSpeech.mockReset(); synthesizeWithDeepgram.mockReset(); });
  afterAll(async () => {
    // Test-only cleanup of synthetic rows; production rows are never deleted.
    await database.query("DELETE FROM tts_usage WHERE message_id = ANY($1::uuid[])", [messageIds]);
    await database.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [users]);
    await database.end();
  });

  it("refuses a reservation that would exceed the monthly cap", async () => {
    const messageId = randomUUID();
    messageIds.push(messageId);
    await database.query("DELETE FROM tts_usage WHERE usage_month = '2099-01'");
    await reserveTtsCharacters({ provider: "google-chirp3-hd", messageId, characters: 60, monthlyCharacterCap: 100, now: testMonth });
    await expect(reserveTtsCharacters({ provider: "google-chirp3-hd", messageId, characters: 41, monthlyCharacterCap: 100, now: testMonth }))
      .rejects.toMatchObject({ code: "TTS_LIMIT_REACHED" });
    await reserveTtsCharacters({ provider: "google-chirp3-hd", messageId, characters: 40, monthlyCharacterCap: 100, now: testMonth });
    await database.query("DELETE FROM tts_usage WHERE usage_month = '2099-01'");
  });

  it("limits how many times one reply can be synthesized", async () => {
    const messageId = randomUUID();
    messageIds.push(messageId);
    for (let i = 0; i < 3; i++) await reserveTtsCharacters({ provider: "google-chirp3-hd", messageId, characters: 1, monthlyCharacterCap: 1000, now: testMonth });
    await expect(reserveTtsCharacters({ provider: "google-chirp3-hd", messageId, characters: 1, monthlyCharacterCap: 1000, now: testMonth }))
      .rejects.toMatchObject({ code: "TTS_MESSAGE_LIMIT" });
    await database.query("DELETE FROM tts_usage WHERE usage_month = '2099-01'");
  });

  it("never overspends under concurrent requests", async () => {
    const ids = Array.from({ length: 8 }, () => randomUUID());
    messageIds.push(...ids);
    const results = await Promise.allSettled(ids.map((messageId) =>
      reserveTtsCharacters({ provider: "google-chirp3-hd", messageId, characters: 30, monthlyCharacterCap: 100, now: testMonth })));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(3);
    const { rows } = await database.query<{ total: string }>("SELECT SUM(characters)::text AS total FROM tts_usage WHERE usage_month = '2099-01'");
    expect(Number(rows[0].total)).toBe(90);
    await database.query("DELETE FROM tts_usage WHERE usage_month = '2099-01'");
  });

  it("reads only the owner's student replies", async () => {
    const { userId, sessionId, messageId } = await studentMessage("Who are the stakeholders?");
    expect(await findStudentMessageText(userId, sessionId, messageId)).toBe("Who are the stakeholders?");
    await expect(findStudentMessageText(randomUUID(), sessionId, messageId)).rejects.toMatchObject({ status: 404 });
    const { rows } = await database.query<{ id: string }>(
      "INSERT INTO messages (session_id, role, text) VALUES ($1, 'user', 'my own words') RETURNING id", [sessionId],
    );
    await expect(findStudentMessageText(userId, sessionId, rows[0].id)).rejects.toMatchObject({ status: 404 });
  });

  it("does not reserve or call the provider without a key", async () => {
    vi.stubEnv("GOOGLE_TTS_API_KEY", "");
    vi.stubEnv("DEEPGRAM_API_KEY", "");
    const { userId, sessionId, messageId } = await studentMessage();
    await expect(speakStudentMessage(userId, sessionId, messageId)).rejects.toMatchObject({ code: "TTS_NOT_CONFIGURED" });
    expect(synthesizeSpeech).not.toHaveBeenCalled();
    const { rowCount } = await database.query("SELECT 1 FROM tts_usage WHERE message_id = $1", [messageId]);
    expect(rowCount).toBe(0);
  });

  it("reserves before synthesis and keeps the reservation when the provider fails", async () => {
    vi.stubEnv("GOOGLE_TTS_API_KEY", "test-key");
    vi.stubEnv("DEEPGRAM_API_KEY", "");
    const { userId, sessionId, messageId } = await studentMessage("Почему это важно?");
    synthesizeSpeech.mockRejectedValueOnce(new Error("provider down"));
    await expect(speakStudentMessage(userId, sessionId, messageId)).rejects.toThrow("provider down");
    expect(synthesizeSpeech).toHaveBeenCalledWith(expect.objectContaining({ languageCode: "ru-RU", text: "Почему это важно?" }));
    const { rows } = await database.query<{ characters: number }>("SELECT characters FROM tts_usage WHERE message_id = $1", [messageId]);
    expect(rows).toEqual([{ characters: 17 }]);
  });

  it("keeps separate monthly totals per provider", async () => {
    const messageId = randomUUID();
    messageIds.push(messageId);
    await reserveTtsCharacters({ provider: "google-chirp3-hd", messageId, characters: 90, monthlyCharacterCap: 100, now: testMonth });
    await reserveTtsCharacters({ provider: "deepgram-aura-2", messageId, characters: 90, monthlyCharacterCap: 100, now: testMonth });
    await expect(reserveTtsCharacters({ provider: "deepgram-aura-2", messageId, characters: 20, monthlyCharacterCap: 100, now: testMonth }))
      .rejects.toMatchObject({ code: "TTS_LIMIT_REACHED" });
    await database.query("DELETE FROM tts_usage WHERE usage_month = '2099-01'");
  });

  it("uses Deepgram for English and reserves under its own provider", async () => {
    vi.stubEnv("DEEPGRAM_API_KEY", "dg-test-key");
    vi.stubEnv("GOOGLE_TTS_API_KEY", "google-test-key");
    const { userId, sessionId, messageId } = await studentMessage("Why does that matter?");
    synthesizeWithDeepgram.mockResolvedValueOnce(new Uint8Array([1, 2, 3]));
    expect(await speakStudentMessage(userId, sessionId, messageId)).toEqual(new Uint8Array([1, 2, 3]));
    expect(synthesizeWithDeepgram).toHaveBeenCalledWith({ apiKey: "dg-test-key", text: "Why does that matter?", voice: "thalia" });
    expect(synthesizeSpeech).not.toHaveBeenCalled();
    const { rows } = await database.query<{ provider: string }>("SELECT provider FROM tts_usage WHERE message_id = $1", [messageId]);
    expect(rows).toEqual([{ provider: "deepgram-aura-2" }]);
  });

  it("does not spend Deepgram credit on Russian replies", async () => {
    vi.stubEnv("DEEPGRAM_API_KEY", "dg-test-key");
    const { userId, sessionId, messageId } = await studentMessage("Почему это важно?");
    await expect(speakStudentMessage(userId, sessionId, messageId)).rejects.toMatchObject({ code: "TTS_LANGUAGE_UNSUPPORTED" });
    expect(synthesizeWithDeepgram).not.toHaveBeenCalled();
    const { rowCount } = await database.query("SELECT 1 FROM tts_usage WHERE message_id = $1", [messageId]);
    expect(rowCount).toBe(0);
  });
});
