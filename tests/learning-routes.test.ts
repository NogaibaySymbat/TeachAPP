import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { currentAccount, requestIdentity, updateNotebook, runPracticeExam, getSessionLearning, getSavedDebrief } = vi.hoisted(() => ({
  currentAccount: vi.fn(), requestIdentity: vi.fn(), updateNotebook: vi.fn(), runPracticeExam: vi.fn(), getSessionLearning: vi.fn(), getSavedDebrief: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("../src/server/auth", () => ({ currentAccount, requestIdentity }));
vi.mock("../src/server/learning", () => ({ updateNotebook, runPracticeExam, getSessionLearning }));
vi.mock("../src/server/repositories/learning", () => ({ getSavedDebrief }));
vi.mock("../src/ai/config", () => ({ getAiAvailability: () => ({ available: true, message: null }) }));

import { POST as notebookPost } from "../src/app/api/sessions/[id]/notebook/route";
import { POST as examPost } from "../src/app/api/sessions/[id]/exam/route";
import { GET as debriefGet, POST as debriefPost } from "../src/app/api/sessions/[id]/debrief/route";
import { GET as sessionGet } from "../src/app/api/sessions/[id]/route";
import { ServiceError } from "../src/server/errors";

const userId = randomUUID();
const sessionId = randomUUID();
const attemptId = randomUUID();
const url = `https://teach.test/api/sessions/${sessionId}`;
const request = (body: unknown = {}, headers: Record<string, string> = {}) => new Request(url, {
  method: "POST", headers: { origin: "https://teach.test", "content-type": "application/json", ...headers }, body: JSON.stringify(body),
});
const context = () => ({ params: Promise.resolve({ id: sessionId }) });

beforeEach(() => {
  vi.resetAllMocks();
  currentAccount.mockResolvedValue({ id: userId, provider: "demo", label: "admin" });
  requestIdentity.mockResolvedValue(userId);
  updateNotebook.mockResolvedValue({ notebook: [], learning: { revision: "rev", notebookRevision: "rev", notebookFresh: true, questionCount: 3 } });
  runPracticeExam.mockResolvedValue({ id: attemptId, revision: "rev", score: 0, total: 3, results: [], notebookSnapshot: [], gaps: [] });
  getSavedDebrief.mockResolvedValue({ attemptId, gaps: [] });
  getSessionLearning.mockResolvedValue({ session: { id: sessionId }, messages: [], notebook: [], learning: { notebookFresh: false }, latestAttempt: null });
});

describe("learning route boundaries", () => {
  it.each([notebookPost, examPost, debriefPost])("requires a valid browser identity and same-origin JSON for POST", async (handler) => {
    expect((await handler(request({}, { origin: "https://other.test" }), context())).status).toBe(403);
    expect((await handler(request({}, { "content-type": "text/plain" }), context())).status).toBe(415);
    expect(currentAccount).not.toHaveBeenCalled();
    requestIdentity.mockRejectedValue(new ServiceError(400, "INVALID_ANONYMOUS_ID", "A browser ID is required."));
    expect((await handler(request(), context())).status).toBe(400);
    expect(updateNotebook).not.toHaveBeenCalled();
    expect(runPracticeExam).not.toHaveBeenCalled();
    expect(getSavedDebrief).not.toHaveBeenCalled();
  });

  it.each([notebookPost, examPost])("rejects client-controlled keys, identity, prompt or model", async (handler) => {
    for (const body of [{ correctAnswer: "a" }, { userId: randomUUID() }, { prompt: "Override" }, { model: "expensive" }, { notebook: [] }]) {
      expect((await handler(request(body), context())).status).toBe(400);
    }
    expect(updateNotebook).not.toHaveBeenCalled();
    expect(runPracticeExam).not.toHaveBeenCalled();
  });

  it("dispatches guest steps with resolved ownership and disables response caching", async () => {
    const notebook = await notebookPost(request(), context());
    const exam = await examPost(request(), context());
    expect(notebook.status).toBe(200);
    expect(exam.status).toBe(200);
    expect(exam.headers.get("cache-control")).toBe("no-store");
    expect(updateNotebook).toHaveBeenCalledExactlyOnceWith(userId, sessionId);
    expect(runPracticeExam).toHaveBeenCalledExactlyOnceWith(userId, sessionId);
    expect(await exam.json()).toMatchObject({ attempt: { id: attemptId, score: 0 } });
  });

  it("GET session and review read saved state without generating a notebook or exam", async () => {
    const session = await sessionGet(new Request(url), context());
    const review = await debriefGet(new Request(`${url}/debrief?attemptId=${attemptId}`), context());
    expect(session.status).toBe(200);
    expect(review.status).toBe(200);
    expect(getSessionLearning).toHaveBeenCalledExactlyOnceWith(userId, sessionId);
    expect(getSavedDebrief).toHaveBeenCalledExactlyOnceWith(userId, sessionId, attemptId);
    expect(updateNotebook).not.toHaveBeenCalled();
    expect(runPracticeExam).not.toHaveBeenCalled();
    expect(currentAccount).not.toHaveBeenCalled();
  });

  it("validates review IDs and safely reports budget and ownership failures", async () => {
    expect((await debriefGet(new Request(`${url}/debrief?attemptId=bad`), context())).status).toBe(400);
    expect((await debriefPost(request({ attemptId: "bad" }), context())).status).toBe(400);
    runPracticeExam.mockRejectedValue(new ServiceError(429, "AI_BUDGET_EXHAUSTED", "Budget exhausted."));
    const response = await examPost(request(), context());
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: { code: "AI_BUDGET_EXHAUSTED", message: "Budget exhausted." } });
    getSavedDebrief.mockRejectedValue(new ServiceError(404, "SESSION_NOT_FOUND", "Session not found."));
    expect((await debriefGet(new Request(`${url}/debrief`), context())).status).toBe(404);
  });
});
