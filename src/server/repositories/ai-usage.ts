import "server-only";
import { getDatabase } from "@/server/db";
import { ServiceError } from "@/server/errors";
import { ECONOMY_MODEL, MAX_BUDGET_NANODOLLARS, MAX_INPUT_TOKENS, MAX_OUTPUT_TOKENS, MAX_STRUCTURED_OUTPUT_TOKENS } from "@/ai/config";

// Standard pricing checked on 2026-11-14. Reserve the most expensive input
// category ($0.25/M for 12h cache writes), plus every allowed output token
// ($0.50/M, including reasoning). One dollar = 1,000,000,000 nanodollars.
// https://developers.openai.com/api/docs/pricing
const INPUT_NANODOLLARS_PER_TOKEN = 250;
const OUTPUT_NANODOLLARS_PER_TOKEN = 500;

interface BudgetReservation {
  model: string;
  inputTokens: number;
  maxOutputTokens?: number;
  budgetNanodollars: number;
}

export async function reserveAiBudget(
  { model, inputTokens, maxOutputTokens = MAX_OUTPUT_TOKENS, budgetNanodollars }: BudgetReservation,
  budgetKey = "openai",
): Promise<string> {
  if (model !== ECONOMY_MODEL || !Number.isInteger(inputTokens) || inputTokens < 0 || inputTokens > MAX_INPUT_TOKENS
    || !Number.isSafeInteger(maxOutputTokens) || maxOutputTokens < 1 || maxOutputTokens > MAX_STRUCTURED_OUTPUT_TOKENS
    || !Number.isSafeInteger(budgetNanodollars) || budgetNanodollars < 0 || budgetNanodollars > MAX_BUDGET_NANODOLLARS) {
    throw new ServiceError(503, "AI_CONFIG_INVALID", "AI replies are unavailable. Your explanation is saved.");
  }
  const reservation = inputTokens * INPUT_NANODOLLARS_PER_TOKEN + maxOutputTokens * OUTPUT_NANODOLLARS_PER_TOKEN;
  const client = await getDatabase().connect();
  try {
    await client.query("BEGIN");
    // Shared transaction lock serializes check-and-reserve across processes.
    // No connection or transaction remains open while the provider is running.
    await client.query("SELECT pg_advisory_xact_lock(163429, hashtext($1))", [budgetKey]);
    const { rows } = await client.query<{ total: string; blocked: boolean }>(
      `SELECT COALESCE(SUM(reserved_nanodollars), 0)::text AS total,
              COALESCE(bool_or(budget_blocked), false) AS blocked
       FROM ai_usage WHERE budget_key = $1`,
      [budgetKey],
    );
    const total = Number(rows[0].total);
    if (rows[0].blocked || !Number.isSafeInteger(total)) {
      throw new ServiceError(503, "AI_BUDGET_REVIEW", "AI replies are paused while usage is reviewed. Your explanation is saved.");
    }
    if (total + reservation > budgetNanodollars) {
      throw new ServiceError(503, "AI_BUDGET_EXHAUSTED", "AI replies are paused because the demo budget is exhausted. Your explanation is saved.");
    }
    const inserted = await client.query<{ id: string }>(
      "INSERT INTO ai_usage (budget_key, model, reserved_nanodollars) VALUES ($1, $2, $3) RETURNING id",
      [budgetKey, model, reservation],
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

// Reservations are deliberately never released, even for successful responses.
// Reported usage is diagnostic only; the cap uses conservative reserved amounts.
export async function recordAiUsage(id: string, inputTokens: number, outputTokens: number): Promise<void> {
  if (!Number.isSafeInteger(inputTokens) || inputTokens < 0 || !Number.isSafeInteger(outputTokens) || outputTokens < 0) return;
  await getDatabase().query(
    "UPDATE ai_usage SET input_tokens = $2, output_tokens = $3 WHERE id = $1",
    [id, inputTokens, outputTokens],
  );
}

export async function blockAiBudget(id: string): Promise<void> {
  await getDatabase().query("UPDATE ai_usage SET budget_blocked = true WHERE id = $1", [id]);
}
