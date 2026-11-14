import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, createClient, getOrCreateAccount, resolveGuestId } = vi.hoisted(() => ({
  getUser: vi.fn(),
  createClient: vi.fn(),
  getOrCreateAccount: vi.fn(),
  resolveGuestId: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@supabase/supabase-js", () => ({ createClient }));
vi.mock("../src/server/repositories/accounts", () => ({ getOrCreateAccount, resolveGuestId }));

import { currentAccount, requestIdentity } from "../src/server/auth";

const subject = "7d88e723-553d-4eba-9d51-b5397d1a735f";
const guest = "e8fed655-84db-4424-baa2-6fc66835029d";
const account = "06a71bd4-289b-4d0b-8e16-7718d3eaec74";

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test-project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-publishable-key");
  createClient.mockReturnValue({ auth: { getUser } });
  getUser.mockResolvedValue({ data: { user: { id: subject, email_confirmed_at: "2026-11-14T00:00:00Z", is_anonymous: false } }, error: null });
  getOrCreateAccount.mockResolvedValue(account);
  resolveGuestId.mockResolvedValue(guest);
});

afterEach(() => vi.unstubAllEnvs());

describe("server identity boundary", () => {
  it("resolves a guest through the database guard", async () => {
    expect(await requestIdentity(new Request("http://localhost", { headers: { "x-anonymous-id": guest } }))).toBe(guest);
    expect(resolveGuestId).toHaveBeenCalledWith(guest);
    expect(getUser).not.toHaveBeenCalled();
  });

  it("uses only the verified subject when a bearer token is present", async () => {
    const request = new Request("http://localhost", { headers: { authorization: "Bearer test-token", "x-anonymous-id": guest } });
    expect(await requestIdentity(request)).toBe(account);
    expect(getUser).toHaveBeenCalledWith("test-token");
    expect(getOrCreateAccount).toHaveBeenCalledWith(subject);
    expect(resolveGuestId).not.toHaveBeenCalled();
  });

  it("uses one Supabase account contract for verified Google and email identities", async () => {
    for (const provider of ["google", "email"]) {
      getUser.mockResolvedValueOnce({ data: { user: {
        id: subject, email: "student@example.test", email_confirmed_at: "2026-11-14T00:00:00Z",
        is_anonymous: false, app_metadata: { provider },
      } }, error: null });
      expect(await currentAccount(new Request("http://localhost", { headers: { authorization: "Bearer verified-token" } })))
        .toEqual({ id: account, label: "student@example.test", provider: "supabase", subject });
    }
    expect(getOrCreateAccount).toHaveBeenCalledWith(subject);
  });

  it("does not downgrade a rejected bearer token to guest access", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { status: 401 } });
    await expect(requestIdentity(new Request("http://localhost", { headers: { authorization: "Bearer invalid-token", "x-anonymous-id": guest } })))
      .rejects.toMatchObject({ status: 401, code: "AUTH_REQUIRED" });
    expect(resolveGuestId).not.toHaveBeenCalled();
    expect(getOrCreateAccount).not.toHaveBeenCalled();
  });

  it.each(["", "Basic test", "Bearer", "Bearer two tokens"])("rejects malformed authorization: %j", async (authorization) => {
    await expect(requestIdentity(new Request("http://localhost", { headers: { authorization, "x-anonymous-id": guest } })))
      .rejects.toMatchObject({ status: 401 });
    expect(createClient).not.toHaveBeenCalled();
    expect(resolveGuestId).not.toHaveBeenCalled();
  });

  it.each([
    { id: subject, is_anonymous: true, email_confirmed_at: "2026-11-14T00:00:00Z" },
    { id: subject, is_anonymous: false, email_confirmed_at: null },
  ])("requires a confirmed, non-anonymous account", async (user) => {
    getUser.mockResolvedValue({ data: { user }, error: null });
    await expect(requestIdentity(new Request("http://localhost", { headers: { authorization: "Bearer test-token" } })))
      .rejects.toMatchObject({ status: 401 });
    expect(getOrCreateAccount).not.toHaveBeenCalled();
  });

  it("fails closed when the authentication provider is not configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    await expect(requestIdentity(new Request("http://localhost", { headers: { authorization: "Bearer test-token", "x-anonymous-id": guest } })))
      .rejects.toMatchObject({ status: 503, code: "AUTH_UNAVAILABLE" });
    expect(resolveGuestId).not.toHaveBeenCalled();
  });

  it("reports provider outages without falling back to a different identity", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { status: 500 } });
    await expect(requestIdentity(new Request("http://localhost", { headers: { authorization: "Bearer test-token" } })))
      .rejects.toMatchObject({ status: 503, code: "AUTH_UNAVAILABLE" });
    expect(resolveGuestId).not.toHaveBeenCalled();
  });
});
