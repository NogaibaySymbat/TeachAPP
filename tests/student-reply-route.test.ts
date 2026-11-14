import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { requestIdentity, replyToExplanation } = vi.hoisted(() => ({ requestIdentity: vi.fn(), replyToExplanation: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("../src/server/auth", () => ({ requestIdentity }));
vi.mock("../src/server/student-reply", () => ({ replyToExplanation }));

import { POST } from "../src/app/api/sessions/[id]/reply/route";
import { ServiceError } from "../src/server/errors";

const accountId = randomUUID();
const sessionId = randomUUID();
const messageId = randomUUID();
const url = `https://teach.test/api/sessions/${sessionId}/reply`;
const request = (body: unknown = { messageId }, headers: Record<string, string> = {}) => new Request(url, {
  method: "POST", headers: { origin: "https://teach.test", "content-type": "application/json", ...headers }, body: JSON.stringify(body),
});
const context = () => ({ params: Promise.resolve({ id: sessionId }) });

beforeEach(() => {
  vi.resetAllMocks();
  requestIdentity.mockResolvedValue(accountId);
  replyToExplanation.mockResolvedValue({ id: randomUUID(), role: "student", text: "Can you give me an example?", createdAt: new Date().toISOString(), replyToMessageId: messageId });
});

describe("paid student reply route", () => {
  it("rejects an invalid browser identity before doing paid work", async () => {
    requestIdentity.mockRejectedValue(new ServiceError(400, "INVALID_ANONYMOUS_ID", "A browser ID is required."));
    const response = await POST(request(), context());
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "INVALID_ANONYMOUS_ID" } });
    expect(replyToExplanation).not.toHaveBeenCalled();
  });

  it("rejects cross-origin requests and non-JSON forms", async () => {
    expect((await POST(request({ messageId }, { origin: "https://other.test" }), context())).status).toBe(403);
    expect((await POST(request({ messageId }, { "content-type": "text/plain" }), context())).status).toBe(415);
    expect(requestIdentity).not.toHaveBeenCalled();
    expect(replyToExplanation).not.toHaveBeenCalled();
  });

  it("rejects client-supplied role, identity, model and invalid message IDs", async () => {
    for (const body of [{ messageId: "invalid" }, { messageId, role: "student" }, { messageId, userId: randomUUID() }, { messageId, model: "expensive" }]) {
      expect((await POST(request(body), context())).status).toBe(400);
    }
    expect(replyToExplanation).not.toHaveBeenCalled();
  });

  it("uses the resolved guest identity and returns the persisted reply without caching", async () => {
    const response = await POST(request(), context());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(replyToExplanation).toHaveBeenCalledExactlyOnceWith(accountId, sessionId, messageId);
    expect(await response.json()).toMatchObject({ message: { role: "student", replyToMessageId: messageId } });
  });

  it("reports recoverable errors without pretending a reply was saved", async () => {
    replyToExplanation.mockRejectedValue(new ServiceError(429, "AI_BUDGET_EXHAUSTED", "The AI budget is used up."));
    const response = await POST(request(), context());
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: { code: "AI_BUDGET_EXHAUSTED", message: "The AI budget is used up." } });
  });
});
