import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { errorDiagnostic } from "../src/server/error-diagnostic";
import { handle } from "../src/server/http";

afterEach(() => vi.restoreAllMocks());

describe("safe server diagnostics", () => {
  it.each([
    ["ECONNRESET", "network:ECONNRESET"],
    ["UNABLE_TO_VERIFY_LEAF_SIGNATURE", "tls:UNABLE_TO_VERIFY_LEAF_SIGNATURE"],
    ["28P01", "postgres:28P01"],
  ])("reports an allowlisted %s without error data", (code, label) => {
    expect(errorDiagnostic(Object.assign(new Error("private query and password"), { code, detail: "private data" }))).toBe(label);
  });

  it("recognizes a fixed driver timeout without echoing arbitrary text", () => {
    expect(errorDiagnostic(new Error("Connection terminated due to connection timeout"))).toBe("database:connection-timeout");
    expect(errorDiagnostic(new Error("timeout expired for private database"))).toBe("unknown");
  });

  it("bounds cyclic causes and supports aggregate connection errors", () => {
    const cycle = new Error("private");
    cycle.cause = cycle;
    expect(errorDiagnostic(cycle)).toBe("unknown");
    expect(errorDiagnostic(new AggregateError([Object.assign(new Error("private"), { code: "ENETUNREACH" })]))).toBe("network:ENETUNREACH");
  });

  it("redacts unknown codes, custom names, stack traces and arbitrary thrown values", () => {
    const secret = "postgresql://user:private-password@private-host/db";
    expect(errorDiagnostic(Object.assign(new Error(secret), { name: secret, code: secret, stack: secret }))).toBe("unknown");
    expect(errorDiagnostic(secret)).toBe("unknown");
    expect(errorDiagnostic({ message: secret, code: secret })).toBe("unknown");
  });

  it("logs only the safe category while keeping the public response generic", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await handle(async () => { throw Object.assign(new Error("sensitive SQL and credentials"), { code: "28P01" }); });
    expect(log).toHaveBeenCalledExactlyOnceWith("API request failed.", "postgres:28P01");
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again later." } });
  });
});
