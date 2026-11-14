import { Client } from "pg";
import { getCACertificates } from "node:tls";
import type { ConnectionOptions, PeerCertificate } from "node:tls";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { databaseConfig } from "../src/server/database-config";

describe("database TLS configuration", () => {
  it("preserves ordinary local PostgreSQL connections without a CA", () => {
    const connectionString = "postgresql://teachapp@127.0.0.1:55433/teachapp";
    expect(databaseConfig(connectionString)).toMatchObject({ connectionString, max: 5 });
    expect(databaseConfig(connectionString).ssl).toBeUndefined();
  });

  it.each([
    "sslmode=verify-full",
    "sslmode=no-verify&ssl=false&uselibpqcompat=true",
    "sslmode=disable&sslrootcert=/missing/ca&sslcert=/missing/cert&sslkey=/missing/key",
    "sslnegotiation=direct&sslmode=require",
  ])("keeps strict CA and hostname verification after pg parses %s", (parameters) => {
    const config = databaseConfig(`postgresql://user:fake%40password@db.example.test:6543/postgres?${parameters}&application_name=teachapp`, "  TEST CA\n  ");
    // Exercise pg's own parser: SSL options in a URI normally overwrite config.ssl.
    const client = new Client(config);
    const parsed = (client as unknown as { connectionParameters: { ssl: ConnectionOptions; password: string; application_name: string } }).connectionParameters;
    expect(parsed.ssl.ca).toEqual([...getCACertificates("default"), "TEST CA"]);
    expect(parsed.ssl.rejectUnauthorized).toBe(true);
    expect(parsed.ssl.checkServerIdentity).toBeTypeOf("function");
    expect(parsed.ssl.checkServerIdentity!("wrong.example.test", { subjectaltname: "DNS:db.example.test" } as PeerCertificate)).toMatchObject({ code: "ERR_TLS_CERT_ALTNAME_INVALID" });
    expect(parsed.password).toBe("fake@password");
    expect(parsed.application_name).toBe("teachapp");
  });

  it("does not expose a malformed connection string through an error", () => {
    expect(() => databaseConfig("sensitive-invalid-url", "TEST CA")).toThrow("Storage configuration is unavailable.");
  });
});
