import "server-only";
import { ServiceError } from "@/server/errors";
import { blockAiBudget, recordAiUsage, reserveAiBudget } from "@/server/repositories/ai-usage";
import { getAiConfig, MAX_INPUT_CHARACTERS, MAX_INPUT_MESSAGES, MAX_INPUT_TOKENS, MAX_OUTPUT_TOKENS, MAX_STRUCTURED_OUTPUT_TOKENS } from "./config";

export interface ModelMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

type JsonObject = Record<string, unknown>;

// These options are chosen by server modules, never forwarded from API bodies.
export interface CompletionOptions {
  maxOutputTokens?: number;
  jsonSchema?: { name: string; schema: JsonObject };
}

function object(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function tokenCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function providerFailure(status?: number): ServiceError {
  if (status === 401 || status === 403 || status === 404) {
    return new ServiceError(503, "AI_PROVIDER_CONFIGURATION", "The AI student could not connect. The site owner needs to check its API access.");
  }
  if (status === 429) {
    return new ServiceError(503, "AI_PROVIDER_LIMIT", "The AI provider is at its limit. Please try again later; your explanation is saved.");
  }
  return new ServiceError(503, "AI_PROVIDER_UNAVAILABLE", "The AI student could not reply. Please try again; your explanation is saved.");
}

// The only module that talks to the LLM provider. Fixed endpoints prevent secrets
// being sent to a configurable host. Never expose raw provider errors or headers.
async function post(path: "input_tokens" | "", apiKey: string, body: JsonObject, signal: AbortSignal): Promise<JsonObject> {
  let response: Response;
  try {
    response = await fetch(`https://api.openai.com/v1/responses${path ? `/${path}` : ""}`, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      redirect: "error",
      signal,
    });
  } catch {
    throw providerFailure();
  }
  if (!response.ok) throw providerFailure(response.status);
  try {
    const result: unknown = await response.json();
    if (!object(result)) throw new Error("Invalid response");
    return result;
  } catch {
    throw providerFailure();
  }
}

export async function complete(messages: ModelMessage[], options: CompletionOptions = {}): Promise<string> {
  const { apiKey, model, budgetNanodollars } = getAiConfig();
  const maxOutputTokens = options.maxOutputTokens ?? MAX_OUTPUT_TOKENS;
  if (!Number.isSafeInteger(maxOutputTokens) || maxOutputTokens < 1 || maxOutputTokens > MAX_STRUCTURED_OUTPUT_TOKENS
    || (options.jsonSchema && (!/^[a-zA-Z0-9_-]{1,64}$/.test(options.jsonSchema.name) || !object(options.jsonSchema.schema)))) {
    throw new ServiceError(503, "AI_CONFIG_INVALID", "The AI student needs a configuration update.");
  }
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_INPUT_MESSAGES
    || messages.some((message) => !message || !["system", "user", "assistant"].includes(message.role)
      || typeof message.content !== "string" || !message.content.trim())
    || messages.reduce((length, message) => length + message.content.length, 0) > MAX_INPUT_CHARACTERS) {
    throw new ServiceError(400, "AI_CONTEXT_TOO_LONG", "Please send a shorter explanation or start a new session.");
  }
  // Copy before the first await, so the counted and generated input is identical.
  const request = {
    model,
    input: messages.map(({ role, content }) => ({ role, content })),
    reasoning: { effort: "none" },
    truncation: "disabled",
    ...(options.jsonSchema ? { text: { format: {
      type: "json_schema", name: options.jsonSchema.name, strict: true,
      schema: structuredClone(options.jsonSchema.schema),
    } } } : {}),
  };
  const signal = AbortSignal.timeout(25_000);
  const count = await post("input_tokens", apiKey, request, signal);
  if (!tokenCount(count.input_tokens)) throw providerFailure();
  if (count.input_tokens > MAX_INPUT_TOKENS) {
    throw new ServiceError(400, "AI_CONTEXT_TOO_LONG", "Please send a shorter explanation or start a new session.");
  }
  const reservationId = await reserveAiBudget({ model, inputTokens: count.input_tokens, maxOutputTokens, budgetNanodollars });
  // No automatic retries. Once reserved, the upper-bound charge remains counted
  // after timeouts/errors too: the upstream request may still have been billed.
  const result = await post("", apiKey, {
    ...request,
    max_output_tokens: maxOutputTokens,
    service_tier: "default",
    store: false,
  }, signal);

  const usage = result.usage;
  const validUsage = object(usage) && tokenCount(usage.input_tokens) && tokenCount(usage.output_tokens);
  if (result.model !== model || result.service_tier !== "default"
    || (validUsage && ((usage.input_tokens as number) > count.input_tokens || (usage.output_tokens as number) > maxOutputTokens))) {
    await blockAiBudget(reservationId);
    throw new ServiceError(503, "AI_BUDGET_REVIEW", "Your student is taking a short break. Your explanation is saved.");
  }
  if (!validUsage) throw providerFailure();
  await recordAiUsage(reservationId, usage.input_tokens as number, usage.output_tokens as number);
  if (result.status !== "completed" || !Array.isArray(result.output)) throw providerFailure();
  const chunks: string[] = [];
  for (const item of result.output) {
    if (!object(item) || item.type !== "message") continue;
    if (item.role !== "assistant" || item.status !== "completed" || !Array.isArray(item.content)) throw providerFailure();
    for (const part of item.content) {
      if (!object(part) || part.type !== "output_text" || typeof part.text !== "string") throw providerFailure();
      chunks.push(part.text);
    }
  }
  const text = chunks.join("\n").trim();
  if (!text || text.length > (options.jsonSchema ? 12_000 : 4_000)) throw providerFailure();
  return text;
}

// Compatibility adapter for AI modules using an async iterable. The first
// integration deliberately yields one complete, validated reply, not token SSE.
export async function* stream(messages: ModelMessage[]): AsyncGenerator<string> {
  yield await complete(messages);
}

export async function completeJson<T>(messages: ModelMessage[], validate: (value: unknown) => T, options: CompletionOptions = {}): Promise<T> {
  const text = await complete(messages, options);
  try {
    return validate(JSON.parse(text));
  } catch {
    throw new ServiceError(503, "AI_INVALID_RESPONSE", "The AI response could not be read. Please try again.");
  }
}
