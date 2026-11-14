import "server-only";
import { ServiceError } from "@/server/errors";

export const ECONOMY_MODEL = "gpt-6-luna";
export const MAX_INPUT_TOKENS = 6_000;
export const MAX_OUTPUT_TOKENS = 256;
export const MAX_STRUCTURED_OUTPUT_TOKENS = 1_536;
export const MAX_INPUT_CHARACTERS = 16_000;
export const MAX_INPUT_MESSAGES = 16;
export const MAX_BUDGET_NANODOLLARS = 4_000_000_000;

export function getAiConfig() {
  const apiKey = (process.env.OPENAI_API_KEY || process.env.LLM_API_KEY || "").trim();
  if (!apiKey) {
    throw new ServiceError(503, "AI_NOT_CONFIGURED", "The AI student is not connected yet.");
  }
  const model = (process.env.OPENAI_MODEL || process.env.LLM_MODEL || ECONOMY_MODEL).trim();
  const budget = process.env.OPENAI_BUDGET_USD?.trim() || "4";
  // Only the reviewed model and a maximum of $4 are enabled for this demo.
  // Parse a decimal amount exactly, so rounding can never increase the cap.
  if (model !== ECONOMY_MODEL || !/^(?:0|[1-4])(?:\.\d{1,9})?$/.test(budget)) {
    throw new ServiceError(503, "AI_CONFIG_INVALID", "The AI student needs a configuration update.");
  }
  const [dollars, fraction = ""] = budget.split(".");
  const budgetNanodollars = Number(dollars) * 1_000_000_000 + Number(fraction.padEnd(9, "0"));
  if (budgetNanodollars > MAX_BUDGET_NANODOLLARS) {
    throw new ServiceError(503, "AI_CONFIG_INVALID", "The AI student needs a configuration update.");
  }
  if (budgetNanodollars === 0) {
    throw new ServiceError(503, "AI_BUDGET_EXHAUSTED", "AI replies are paused because the demo budget is exhausted.");
  }
  return { apiKey, model, budgetNanodollars };
}

// This only describes configuration readiness, not provider access or remaining credit.
export function getAiAvailability(): { available: boolean; message: string | null } {
  try {
    getAiConfig();
    return { available: true, message: null };
  } catch (error) {
    return { available: false, message: error instanceof ServiceError ? error.message : "The AI student is unavailable." };
  }
}
