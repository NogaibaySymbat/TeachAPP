import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../src/server/db", () => ({ getDatabase: () => database }));

import { blockAiBudget, recordAiUsage, reserveAiBudget } from "../src/server/repositories/ai-usage";

let database = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
const keys: string[] = [];
function budgetKey() { const key = `test-${randomUUID()}`; keys.push(key); return key; }
const reservation = { model: "gpt-6-luna", inputTokens: 100, budgetNanodollars: 459_000 };

describe.skipIf(!process.env.TEST_DATABASE_URL)("durable AI budget (isolated test database)", () => {
  beforeAll(async () => {
    await database.query(await readFile(new URL("../db/schema.sql", import.meta.url), "utf8"));
  });

  afterAll(async () => {
    await database.query("DELETE FROM ai_usage WHERE budget_key = ANY($1::text[])", [keys]);
    await database.end();
  });

  it("atomically limits concurrent callers sharing the same budget", async () => {
    const key = budgetKey();
    const outcomes = await Promise.allSettled(Array.from({ length: 10 }, () => reserveAiBudget(reservation, key)));
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(3);
    expect(outcomes.filter((outcome) => outcome.status === "rejected")).toHaveLength(7);
    for (const outcome of outcomes) if (outcome.status === "rejected") expect(outcome.reason).toMatchObject({ code: "AI_BUDGET_EXHAUSTED" });
    const { rows } = await database.query("SELECT SUM(reserved_nanodollars)::text AS total FROM ai_usage WHERE budget_key = $1", [key]);
    expect(Number(rows[0].total)).toBe(459_000);
  });

  it("retains reservations after reported usage and a new database connection", async () => {
    const key = budgetKey();
    const request = { ...reservation, budgetNanodollars: 153_000 };
    const id = await reserveAiBudget(request, key);
    await recordAiUsage(id, 100, 1);
    await database.end();
    database = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    const { rows } = await database.query("SELECT reserved_nanodollars::text, input_tokens, output_tokens FROM ai_usage WHERE id = $1", [id]);
    expect(rows[0]).toEqual({ reserved_nanodollars: "153000", input_tokens: 100, output_tokens: 1 });
    await expect(reserveAiBudget(request, key)).rejects.toMatchObject({ code: "AI_BUDGET_EXHAUSTED" });
  });

  it("blocks subsequent generations after an unexpected pricing assumption", async () => {
    const key = budgetKey();
    const id = await reserveAiBudget(reservation, key);
    await blockAiBudget(id);
    await expect(reserveAiBudget(reservation, key)).rejects.toMatchObject({ code: "AI_BUDGET_REVIEW" });
  });

  it("rejects invalid caps and rejects a reservation that cannot fit", async () => {
    const key = budgetKey();
    await expect(reserveAiBudget({ ...reservation, budgetNanodollars: 4_000_000_001 }, key)).rejects.toMatchObject({ code: "AI_CONFIG_INVALID" });
    await expect(reserveAiBudget({ ...reservation, budgetNanodollars: 152_999 }, key)).rejects.toMatchObject({ code: "AI_BUDGET_EXHAUSTED" });
    const { rows } = await database.query("SELECT COUNT(*)::int AS count FROM ai_usage WHERE budget_key = $1", [key]);
    expect(rows[0].count).toBe(0);
  });

  it("reserves the actual structured output cap in the same shared ledger", async () => {
    const key = budgetKey();
    const request = { ...reservation, budgetNanodollars: 946_000 };
    const notebook = await reserveAiBudget({ ...request, maxOutputTokens: 1024 }, key);
    const exam = await reserveAiBudget({ ...request, maxOutputTokens: 768 }, key);
    const { rows } = await database.query("SELECT id, reserved_nanodollars::text AS amount FROM ai_usage WHERE budget_key = $1", [key]);
    expect(rows).toEqual(expect.arrayContaining([{ id: notebook, amount: "537000" }, { id: exam, amount: "409000" }]));
    await expect(reserveAiBudget({ ...request, maxOutputTokens: 1 }, key)).rejects.toMatchObject({ code: "AI_BUDGET_EXHAUSTED" });
  });

  it.each([0, -1, 1537, 1.5, Number.NaN])("rejects invalid output allowance %s without inserting a reservation", async (maxOutputTokens) => {
    const key = budgetKey();
    await expect(reserveAiBudget({ ...reservation, maxOutputTokens }, key)).rejects.toMatchObject({ code: "AI_CONFIG_INVALID" });
    const { rows } = await database.query("SELECT COUNT(*)::int AS count FROM ai_usage WHERE budget_key = $1", [key]);
    expect(rows[0].count).toBe(0);
  });
});
