import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const ledger = vi.hoisted(() => ({ reserveAiBudget: vi.fn(), recordAiUsage: vi.fn(), blockAiBudget: vi.fn() }));
vi.mock("../src/server/repositories/ai-usage", () => ledger);

import { complete, completeJson, type ModelMessage } from "../src/ai/client";
import { getAiAvailability, getAiConfig } from "../src/ai/config";
import { ServiceError } from "../src/server/errors";

const messages: ModelMessage[] = [{ role: "system", content: "Ask a short question." }, { role: "user", content: "Stakeholders affect a project." }];
const fetchMock = vi.fn();
const result = (overrides: Record<string, unknown> = {}) => ({
  model: "gpt-6-luna", service_tier: "default", status: "completed",
  usage: { input_tokens: 20, output_tokens: 12 },
  output: [{ type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text: "Can you give me an example?" }] }],
  ...overrides,
});

function countThenReply(reply = result(), count = 20) {
  fetchMock.mockResolvedValueOnce(Response.json({ object: "response.input_tokens", input_tokens: count }));
  fetchMock.mockResolvedValueOnce(Response.json(reply));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("OPENAI_API_KEY", "test-key-not-real");
  vi.stubEnv("OPENAI_MODEL", "");
  vi.stubEnv("OPENAI_BUDGET_USD", "");
  vi.stubEnv("LLM_API_KEY", "");
  vi.stubEnv("LLM_MODEL", "");
  ledger.reserveAiBudget.mockResolvedValue("reservation-id");
  ledger.recordAiUsage.mockResolvedValue(undefined);
  ledger.blockAiBudget.mockResolvedValue(undefined);
});

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); fetchMock.mockReset(); });

describe("OpenAI configuration", () => {
  it("uses the reviewed economy model and a $4 cap by default", () => {
    expect(getAiConfig()).toMatchObject({ model: "gpt-6-luna", budgetNanodollars: 4_000_000_000 });
    expect(getAiAvailability()).toEqual({ available: true, message: null });
  });

  it("fails without a key before touching the provider or budget", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    await expect(complete(messages)).rejects.toMatchObject({ code: "AI_NOT_CONFIGURED" });
    expect(getAiAvailability().available).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(ledger.reserveAiBudget).not.toHaveBeenCalled();
  });

  it.each(["5", "4.000000001", "-1", "NaN", "Infinity", "1e0", "0.1234567890"])("rejects unsafe budget %s", (budget) => {
    vi.stubEnv("OPENAI_BUDGET_USD", budget);
    expect(() => getAiConfig()).toThrow(expect.objectContaining({ code: "AI_CONFIG_INVALID" }));
  });

  it("parses a lower decimal cap exactly and supports pausing at zero", () => {
    vi.stubEnv("OPENAI_BUDGET_USD", "0.100000001");
    expect(getAiConfig().budgetNanodollars).toBe(100_000_001);
    vi.stubEnv("OPENAI_BUDGET_USD", "0");
    expect(() => getAiConfig()).toThrow(expect.objectContaining({ code: "AI_BUDGET_EXHAUSTED" }));
  });

  it("rejects unpriced models instead of silently switching", async () => {
    vi.stubEnv("OPENAI_MODEL", "gpt-6-astra");
    await expect(complete(messages)).rejects.toMatchObject({ code: "AI_CONFIG_INVALID" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("bounded OpenAI Responses calls", () => {
  it("counts exactly the generated input, reserves first, and reads real output content", async () => {
    countThenReply();
    expect(await complete(messages)).toBe("Can you give me an example?");
    const countRequest = JSON.parse(fetchMock.mock.calls[0][1].body);
    const generationRequest = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.openai.com/v1/responses/input_tokens");
    expect(fetchMock.mock.calls[1][0]).toBe("https://api.openai.com/v1/responses");
    expect(generationRequest).toEqual({ ...countRequest, max_output_tokens: 256, service_tier: "default", store: false });
    expect(countRequest).toEqual({ model: "gpt-6-luna", input: messages, reasoning: { effort: "none" }, truncation: "disabled" });
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ redirect: "error", cache: "no-store" });
    expect(fetchMock.mock.calls[0][1].signal).toBe(fetchMock.mock.calls[1][1].signal);
    expect(ledger.reserveAiBudget).toHaveBeenCalledWith({ model: "gpt-6-luna", inputTokens: 20, maxOutputTokens: 256, budgetNanodollars: 4_000_000_000 });
    expect(ledger.reserveAiBudget.mock.invocationCallOrder[0]).toBeLessThan(fetchMock.mock.invocationCallOrder[1]);
    expect(ledger.recordAiUsage).toHaveBeenCalledWith("reservation-id", 20, 12);
  });

  it("rejects excessive local context without contacting OpenAI", async () => {
    await expect(complete([{ role: "user", content: "x".repeat(16_001) }])).rejects.toMatchObject({ code: "AI_CONTEXT_TOO_LONG" });
    await expect(complete(Array.from({ length: 17 }, () => messages[0]))).rejects.toMatchObject({ code: "AI_CONTEXT_TOO_LONG" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("stops before generation when the token count exceeds the cap", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ input_tokens: 6001 }));
    await expect(complete(messages)).rejects.toMatchObject({ code: "AI_CONTEXT_TOO_LONG" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(ledger.reserveAiBudget).not.toHaveBeenCalled();
  });

  it.each([-1, 1.5, "20", null])("fails closed for invalid token count %s", async (input_tokens) => {
    fetchMock.mockResolvedValueOnce(Response.json({ input_tokens }));
    await expect(complete(messages)).rejects.toMatchObject({ code: "AI_PROVIDER_UNAVAILABLE" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(ledger.reserveAiBudget).not.toHaveBeenCalled();
  });

  it("does not generate if a concurrent reservation consumed the remaining budget", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ input_tokens: 20 }));
    ledger.reserveAiBudget.mockRejectedValueOnce(new ServiceError(503, "AI_BUDGET_EXHAUSTED", "Budget exhausted"));
    await expect(complete(messages)).rejects.toMatchObject({ code: "AI_BUDGET_EXHAUSTED" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([401, 429, 500])("does not retry or expose provider error bodies for HTTP %s", async (status) => {
    fetchMock.mockResolvedValueOnce(Response.json({ input_tokens: 20 }));
    fetchMock.mockResolvedValueOnce(Response.json({ error: { message: "SECRET provider detail test-key-not-real" } }, { status }));
    await expect(complete(messages)).rejects.not.toThrow(/SECRET|test-key-not-real/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(ledger.reserveAiBudget).toHaveBeenCalledTimes(1);
    expect(ledger.recordAiUsage).not.toHaveBeenCalled();
  });

  it("keeps the reservation and does not retry after an interrupted generation", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ input_tokens: 20 }));
    fetchMock.mockRejectedValueOnce(new DOMException("SECRET", "TimeoutError"));
    await expect(complete(messages)).rejects.toMatchObject({ code: "AI_PROVIDER_UNAVAILABLE" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(ledger.reserveAiBudget).toHaveBeenCalledTimes(1);
    expect(ledger.recordAiUsage).not.toHaveBeenCalled();
  });

  it.each([
    { model: "other-model" },
    { service_tier: "fast" },
    { usage: { input_tokens: 21, output_tokens: 12 } },
    { usage: { input_tokens: 20, output_tokens: 257 } },
  ])("blocks future usage when provider output breaks pricing assumptions: %j", async (overrides) => {
    countThenReply(result(overrides));
    await expect(complete(messages)).rejects.toMatchObject({ code: "AI_BUDGET_REVIEW" });
    expect(ledger.blockAiBudget).toHaveBeenCalledWith("reservation-id");
  });

  it.each([
    { status: "incomplete" },
    { output: [] },
    { output: [{ type: "message", role: "assistant", status: "completed", content: [{ type: "refusal", refusal: "No" }] }] },
    { usage: null },
  ])("rejects incomplete, refused or malformed responses without retry: %j", async (overrides) => {
    countThenReply(result(overrides));
    await expect(complete(messages)).rejects.toMatchObject({ code: "AI_PROVIDER_UNAVAILABLE" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not pay for a second generation on invalid JSON", async () => {
    countThenReply();
    await expect(completeJson(messages, (value) => value)).rejects.toMatchObject({ code: "AI_INVALID_RESPONSE" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(ledger.reserveAiBudget).toHaveBeenCalledTimes(1);
  });

  it("counts the exact strict JSON schema and reserves a larger bounded structured response", async () => {
    const schema = { type: "object", properties: { answers: { type: "array", items: { type: "string" } } }, required: ["answers"], additionalProperties: false };
    const json = { answers: ["b"] };
    countThenReply(result({
      usage: { input_tokens: 20, output_tokens: 512 },
      output: [{ type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text: JSON.stringify(json) }] }],
    }));
    const pending = completeJson(messages, (value) => value, { maxOutputTokens: 768, jsonSchema: { name: "test_answers", schema } });
    schema.required.push("changed_after_count");
    expect(await pending).toEqual(json);
    const counted = JSON.parse(fetchMock.mock.calls[0][1].body);
    const generated = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(counted.text.format).toMatchObject({ type: "json_schema", name: "test_answers", strict: true });
    expect(counted.text.format.schema.required).toEqual(["answers"]);
    expect(generated).toEqual({ ...counted, max_output_tokens: 768, service_tier: "default", store: false });
    expect(ledger.reserveAiBudget).toHaveBeenCalledWith(expect.objectContaining({ maxOutputTokens: 768 }));
    expect(ledger.blockAiBudget).not.toHaveBeenCalled();
  });

  it.each([0, -1, 1.5, 1537, Number.NaN, Number.POSITIVE_INFINITY])("rejects output budget %s before any provider request", async (maxOutputTokens) => {
    await expect(complete(messages, { maxOutputTokens })).rejects.toMatchObject({ code: "AI_CONFIG_INVALID" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(ledger.reserveAiBudget).not.toHaveBeenCalled();
  });

  it("blocks usage above the per-call output limit", async () => {
    countThenReply(result({ usage: { input_tokens: 20, output_tokens: 769 } }));
    await expect(complete(messages, { maxOutputTokens: 768 })).rejects.toMatchObject({ code: "AI_BUDGET_REVIEW" });
    expect(ledger.blockAiBudget).toHaveBeenCalledWith("reservation-id");
  });
});
