import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient }));

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-test-key");
  vi.stubGlobal("window", { location: { href: "https://study.example/auth/callback#access_token=callback-token&refresh_token=callback-refresh" } });
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("callback capture before SDK initialization", () => {
  it("retains the original fragment even if SDK construction consumes it before callback hydration", async () => {
    const auth = await import("../src/lib/auth-client");
    const original = window.location.href;
    const client = { auth: {} };
    createClient.mockImplementationOnce(() => {
      expect(auth.getAuthCallbackSnapshot()).toEqual({ href: original, initializedWithCallback: true });
      window.location.href = "https://study.example/auth/callback";
      return client;
    });
    expect(auth.getAuthClient()).toBe(client);
    expect(auth.getAuthCallbackSnapshot()).toEqual({ href: original, initializedWithCallback: true });
    auth.clearAuthCallbackSnapshot();
    expect(auth.getAuthCallbackSnapshot()).toEqual({ href: window.location.href, initializedWithCallback: false });
  });

  it("captures callback errors before SDK initialization without persisting tokens to browser storage", async () => {
    const auth = await import("../src/lib/auth-client");
    window.location.href = "https://study.example/auth/callback#error=access_denied&error_description=Google+cancelled";
    const original = window.location.href;
    createClient.mockImplementationOnce(() => {
      window.location.href = "https://study.example/auth/callback";
      return { auth: {} };
    });
    auth.getAuthClient();
    expect(auth.getAuthCallbackSnapshot()).toEqual({ href: original, initializedWithCallback: true });
  });

  it("does not claim that an existing client initialized against a new callback URL", async () => {
    const auth = await import("../src/lib/auth-client");
    window.location.href = "https://study.example/login";
    createClient.mockReturnValueOnce({ auth: {} });
    auth.getAuthClient();
    expect(auth.getAuthCallbackSnapshot()).toBeNull();
    window.location.href = "https://study.example/auth/callback#access_token=new-token&refresh_token=new-refresh";
    auth.getAuthClient();
    expect(auth.getAuthCallbackSnapshot()).toEqual({ href: window.location.href, initializedWithCallback: false });
    expect(createClient).toHaveBeenCalledOnce();
  });
});
