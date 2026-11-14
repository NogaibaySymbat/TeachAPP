import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getAnonymousId, resetAnonymousId } = vi.hoisted(() => ({ getAnonymousId: vi.fn(), resetAnonymousId: vi.fn() }));
vi.mock("../src/lib/anon-id", () => ({ getAnonymousId, resetAnonymousId }));
import { api } from "../src/lib/api";

beforeEach(() => {
  vi.resetAllMocks();
  getAnonymousId.mockReturnValue("browser-a");
  vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => Response.json({ sessions: [] })));
});
afterEach(() => vi.unstubAllGlobals());

describe("browser-owned study requests", () => {
  it("keeps the browser identity across requests and never sends old login cookies or bearer tokens", async () => {
    await api("/api/sessions", { credentials: "include", headers: { authorization: "Bearer old-account" } });
    await api("/api/sessions");
    for (const [, init] of vi.mocked(fetch).mock.calls) {
      expect(init?.credentials).toBe("omit");
      expect(new Headers(init?.headers).get("x-anonymous-id")).toBe("browser-a");
      expect(new Headers(init?.headers).has("authorization")).toBe(false);
    }
  });

  it("replaces an ID retired by a previous account import without exposing the account", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ error: { code: "SIGN_IN_REQUIRED" } }, { status: 401 }));
    resetAnonymousId.mockReturnValue("browser-b");
    await api("/api/sessions");
    expect(resetAnonymousId).toHaveBeenCalledOnce();
    expect(new Headers(vi.mocked(fetch).mock.calls[1][1]?.headers).get("x-anonymous-id")).toBe("browser-b");
  });
});
