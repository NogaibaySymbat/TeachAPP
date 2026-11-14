import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(), createClient: vi.fn(), getOrCreateAccount: vi.fn(),
  getOrCreateDemoAccount: vi.fn(), findDemoAccount: vi.fn(), resolveGuestId: vi.fn(),
  listSessions: vi.fn(), createSession: vi.fn(), getTopics: vi.fn(), getTopic: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));
vi.mock("../src/server/repositories/accounts", () => ({
  getOrCreateAccount: mocks.getOrCreateAccount, getOrCreateDemoAccount: mocks.getOrCreateDemoAccount,
  findDemoAccount: mocks.findDemoAccount, resolveGuestId: mocks.resolveGuestId,
}));
vi.mock("../src/server/repositories/sessions", () => ({ listSessions: mocks.listSessions, createSession: mocks.createSession }));
vi.mock("../src/server/content", () => ({ getTopics: mocks.getTopics, getTopic: mocks.getTopic }));

import { DEMO_COOKIE_NAME, DEMO_SESSION_SECONDS, createDemoToken, demoLoginAvailable, readDemoAccountId } from "../src/server/demo-auth";
import { currentAccount, requestIdentity } from "../src/server/auth";
import { DELETE, POST } from "../src/app/api/auth/demo/route";
import { GET as getMe } from "../src/app/api/auth/me/route";
import { GET as getHistory } from "../src/app/api/sessions/route";

const demoId = "7dd258fc-ad1e-4265-913d-d8f9d92ad9ad";
const emailId = "35d253fd-509a-4171-a2a4-c2d098c891e4";
const subject = "c09ac695-4f36-43f1-b35f-8d8d63a859e7";
const guestId = "dcb494d8-883d-4bfa-9ad5-43b2517224b3";
const origin = "http://localhost:3000";

function loginRequest(body = { username: "admin", password: "admin" }, headers?: HeadersInit) {
  return new Request(`${origin}/api/auth/demo`, {
    method: "POST", headers: { origin, "content-type": "application/json", ...headers }, body: JSON.stringify(body),
  });
}
function cookieRequest(token = createDemoToken(demoId), headers?: HeadersInit, url = `${origin}/api/topics`) {
  return new Request(url, { headers: { cookie: `${DEMO_COOKIE_NAME}=${token}`, "x-anonymous-id": guestId, ...headers } });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("DEMO_AUTH_ENABLED", "true");
  vi.stubEnv("AUTH_SECRET", "test-only-auth-secret-at-least-32-characters");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test-project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-key");
  mocks.getOrCreateDemoAccount.mockResolvedValue(demoId);
  mocks.findDemoAccount.mockResolvedValue(true);
  mocks.resolveGuestId.mockResolvedValue(guestId);
  mocks.createClient.mockReturnValue({ auth: { getUser: mocks.getUser } });
  mocks.getUser.mockResolvedValue({ data: { user: {
    id: subject, email: "student@example.test", email_confirmed_at: "2026-11-14", is_anonymous: false,
  } }, error: null });
  mocks.getOrCreateAccount.mockResolvedValue(emailId);
  mocks.getTopics.mockResolvedValue([]);
  mocks.listSessions.mockResolvedValue({ sessions: [], nextOffset: null });
});
afterEach(() => { vi.unstubAllEnvs(); });

describe("temporary admin login", () => {
  it("accepts admin/admin and issues an eight-hour HttpOnly session", async () => {
    const response = await POST(loginRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ account: { id: demoId, label: "admin", provider: "demo" } });
    const cookie = response.headers.get("set-cookie")!;
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain(`Max-Age=${DEMO_SESSION_SECONDS}`);
    expect(cookie).not.toContain("Secure");
    const request = new Request(origin, { headers: { cookie: cookie.split(";")[0] } });
    expect(readDemoAccountId(request)).toBe(demoId);
    expect(mocks.getOrCreateDemoAccount).toHaveBeenCalledTimes(1);
  });

  it("sets Secure on an HTTPS session", async () => {
    const request = new Request("https://study.example/api/auth/demo", {
      method: "POST", headers: { origin: "https://study.example", "content-type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "admin" }),
    });
    expect((await POST(request)).headers.get("set-cookie")).toContain("; Secure");
  });

  it.each([
    { username: "admin", password: "wrong" },
    { username: "someone", password: "admin" },
  ])("rejects incorrect credentials without creating an account", async (body) => {
    const response = await POST(loginRequest(body));
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: { code: "INVALID_CREDENTIALS" } });
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(mocks.getOrCreateDemoAccount).not.toHaveBeenCalled();
  });

  it.each(["false", ""])("does not enable demo login implicitly: %j", async (enabled) => {
    vi.stubEnv("DEMO_AUTH_ENABLED", enabled);
    expect(demoLoginAvailable()).toBe(false);
    expect((await POST(loginRequest())).status).toBe(503);
    expect(mocks.getOrCreateDemoAccount).not.toHaveBeenCalled();
  });

  it("requires a signing secret of sufficient length", async () => {
    vi.stubEnv("AUTH_SECRET", "short");
    expect(demoLoginAvailable()).toBe(false);
    expect((await POST(loginRequest())).status).toBe(503);
  });

  it.each(["https://attacker.example", "null", ""])("rejects a nonmatching Origin: %j", async (requestOrigin) => {
    const response = await POST(loginRequest(undefined, { origin: requestOrigin }));
    expect(response.status).toBe(403);
    expect(mocks.getOrCreateDemoAccount).not.toHaveBeenCalled();
  });

  it("rejects a missing Origin and non-JSON submissions", async () => {
    const request = loginRequest();
    request.headers.delete("origin");
    expect((await POST(request)).status).toBe(403);
    expect((await POST(loginRequest(undefined, { "content-type": "text/plain" }))).status).toBe(415);
  });

  it("checks the browser Host when Next normalizes the request URL to localhost", async () => {
    const response = await POST(loginRequest(undefined, { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" }));
    expect(response.status).toBe(200);
    const rejected = await POST(loginRequest(undefined, { host: "127.0.0.1:3000", origin }));
    expect(rejected.status).toBe(403);
    expect(await rejected.json()).toMatchObject({ error: { code: "INVALID_ORIGIN" } });
  });

  it("does not allow forwarded-host to override the actual browser destination", async () => {
    const response = await POST(loginRequest(undefined, {
      host: "127.0.0.1:3000", "x-forwarded-host": "attacker.example", origin: "http://attacker.example",
    }));
    expect(response.status).toBe(403);
  });

  it("clears the exact session cookie when logging out", async () => {
    const response = await DELETE(new Request(`${origin}/api/auth/demo`, { method: "DELETE", headers: { origin } }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(response.headers.get("set-cookie")).toBe(`${DEMO_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
    const crossOrigin = await DELETE(new Request(`${origin}/api/auth/demo`, { method: "DELETE", headers: { origin: "https://other.example" } }));
    expect(crossOrigin.status).toBe(403);
    expect(crossOrigin.headers.get("set-cookie")).toBeNull();
  });
});

describe("demo session verification and account boundary", () => {
  it("recognizes a valid signed cookie and resolves only its account", async () => {
    expect(await requestIdentity(cookieRequest())).toBe(demoId);
    expect(mocks.findDemoAccount).toHaveBeenCalledWith(demoId);
    expect(mocks.resolveGuestId).not.toHaveBeenCalled();
  });

  it("rejects a modified payload even when it names a valid account", async () => {
    const [payload, signature] = createDemoToken(demoId).split(".");
    const tampered = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, "base64url").toString()), accountId: emailId })).toString("base64url");
    await expect(requestIdentity(cookieRequest(`${tampered}.${signature}`))).rejects.toMatchObject({ status: 401, code: "AUTH_REQUIRED" });
    expect(mocks.resolveGuestId).not.toHaveBeenCalled();
    expect(mocks.findDemoAccount).not.toHaveBeenCalled();
  });

  it.each(["", "garbage", "a.b", "a.b.c"])("fails closed for malformed cookie %j", async (token) => {
    await expect(requestIdentity(cookieRequest(token))).rejects.toMatchObject({ status: 401 });
    expect(mocks.resolveGuestId).not.toHaveBeenCalled();
  });

  it("rejects expiration, duplicate cookies, a rotated secret and a disabled demo", async () => {
    const old = createDemoToken(demoId, Date.now() - DEMO_SESSION_SECONDS * 1000);
    expect(() => readDemoAccountId(cookieRequest(old))).toThrow();
    const token = createDemoToken(demoId);
    expect(() => readDemoAccountId(cookieRequest(token, { cookie: `${DEMO_COOKIE_NAME}=${token}; ${DEMO_COOKIE_NAME}=${token}` }))).toThrow();
    vi.stubEnv("AUTH_SECRET", "a-different-secret-with-more-than-32-characters");
    expect(() => readDemoAccountId(cookieRequest(token))).toThrow();
    vi.stubEnv("DEMO_AUTH_ENABLED", "false");
    await expect(requestIdentity(cookieRequest(token))).rejects.toMatchObject({ status: 401 });
  });

  it("rejects a cookie for a removed or non-demo account", async () => {
    mocks.findDemoAccount.mockResolvedValue(false);
    await expect(requestIdentity(cookieRequest())).rejects.toMatchObject({ status: 401 });
    expect(mocks.resolveGuestId).not.toHaveBeenCalled();
  });

  it("uses verified email identity ahead of a demo cookie", async () => {
    expect(await currentAccount(cookieRequest(undefined, { authorization: "Bearer email-token" }))).toEqual({
      id: emailId, label: "student@example.test", provider: "supabase", subject,
    });
    expect(mocks.findDemoAccount).not.toHaveBeenCalled();
  });

  it("never falls back to demo when an explicit bearer token is rejected", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { status: 401 } });
    await expect(requestIdentity(cookieRequest(undefined, { authorization: "Bearer bad-token" }))).rejects.toMatchObject({ status: 401 });
    expect(mocks.findDemoAccount).not.toHaveBeenCalled();
    expect(mocks.resolveGuestId).not.toHaveBeenCalled();
  });

  it("reports an anonymous session without opening the database", async () => {
    const response = await getMe(new Request(`${origin}/api/auth/me`));
    expect(await response.json()).toEqual({ account: null, demoAvailable: true });
    expect(mocks.findDemoAccount).not.toHaveBeenCalled();
    expect(mocks.getOrCreateDemoAccount).not.toHaveBeenCalled();
  });

  it("lists guest history by browser identity and preserves verified legacy account access", async () => {
    const guestResponse = await getHistory(new Request(`${origin}/api/sessions`, { headers: { "x-anonymous-id": guestId } }));
    expect(guestResponse.status).toBe(200);
    expect(mocks.listSessions).toHaveBeenCalledWith(guestId, 0);
    const demoResponse = await getHistory(cookieRequest(undefined, undefined, `${origin}/api/sessions`));
    expect(demoResponse.status).toBe(200);
    expect(mocks.listSessions).toHaveBeenCalledWith(demoId, 0);
  });
});
