import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Message } from "../src/lib/types";

const { complete, getTopic } = vi.hoisted(() => ({ complete: vi.fn(), getTopic: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("../src/ai/client", () => ({ complete }));
vi.mock("../src/server/content", () => ({ getTopic }));

import { buildStudentMessages, completeStudentReply } from "../src/ai/student";

const message = (text: string, role: Message["role"] = "user"): Message => ({
  id: "unused", text, role, createdAt: new Date().toISOString(),
});

beforeEach(() => {
  vi.resetAllMocks();
  getTopic.mockResolvedValue({ title: "Team communication", keyIdeas: [{ text: "SECRET ANSWER KEY" }], misconceptions: ["SECRET MISCONCEPTION"] });
  complete.mockResolvedValue("Could you give me an example?");
});

describe("student prompt and limited context", () => {
  it("sends the role and topic without answer keys or notebook claims", async () => {
    await expect(completeStudentReply({ topicId: "communication", history: [message("Explain roles clearly.")], notebook: [{ id: "n", claim: "SECRET NOTEBOOK", sourceMessageId: "m" }] }))
      .resolves.toBe("Could you give me an example?");
    const prompt = complete.mock.calls[0][0];
    expect(prompt[0].role).toBe("system");
    expect(prompt[0].content).toContain("Team communication");
    expect(prompt[0].content).toContain("same language");
    expect(prompt[0].content).toContain("do not supply your own facts");
    expect(JSON.stringify(prompt)).not.toContain("SECRET");
    expect(prompt.at(-1)).toEqual({ role: "user", content: "Explain roles clearly." });
    expect(complete).toHaveBeenCalledOnce();
  });

  it("preserves the latest explanation while dropping old context at whole-message boundaries", async () => {
    const history = Array.from({ length: 30 }, (_, index) => message(`${index}: ${"x".repeat(1500)}`, index % 2 ? "user" : "student"));
    const result = await buildStudentMessages({ topicId: "communication", history, notebook: [] });
    const context = result.slice(1);
    expect(context.length).toBeLessThanOrEqual(12);
    expect(context.reduce((sum, item) => sum + item.content.length, 0)).toBeLessThanOrEqual(12000);
    expect(context[0].role).toBe("user");
    expect(context.at(-1)?.content).toBe(history.at(-1)?.text);
    expect(context.some((item) => item.content.startsWith("0:"))).toBe(false);
  });

  it("rejects a missing user explanation or too-long source before calling the provider", async () => {
    for (const history of [[], [message("   ")], [message("A question?", "student")], [message("x".repeat(4001))]]) {
      await expect(completeStudentReply({ topicId: "communication", history, notebook: [] })).rejects.toMatchObject({ status: 400 });
    }
    expect(complete).not.toHaveBeenCalled();
  });
});
