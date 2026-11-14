import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
let database: { query: (...args: never[]) => Promise<unknown>; connect?: () => Promise<unknown> };
vi.mock("../src/server/db", () => ({ getDatabase: () => database }));

import { assertPaidRequestAllowed, clientAddress, networkKey, paidLimits } from "../src/server/repositories/rate-limit";

const request = (ip: string) => new Request("https://teachapp.test/api", { headers: { "x-forwarded-for": `${ip}, 10.0.0.1` } });

describe("rate limit helpers", () => {
  it("reads the client address from Vercel headers", () => {
    expect(clientAddress(new Request("https://x.test", { headers: { "x-real-ip": "1.2.3.4", "x-forwarded-for": "5.6.7.8" } }))).toBe("1.2.3.4");
    expect(clientAddress(request("9.9.9.9"))).toBe("9.9.9.9");
    expect(clientAddress(new Request("https://x.test"))).toBe("unknown");
  });

  it("stores a keyed hash, never the address", () => {
    const key = networkKey("1.2.3.4", "secret");
    expect(key).not.toContain("1.2.3.4");
    expect(key).toHaveLength(32);
    expect(networkKey("1.2.3.4", "secret")).toBe(key);
    expect(networkKey("1.2.3.4", "other")).not.toBe(key);
  });

  it("uses generous defaults and accepts only positive overrides", () => {
    expect(paidLimits({})).toEqual({ perNetwork: 120, site: 600 });
    expect(paidLimits({ PAID_REQUESTS_PER_IP_PER_HOUR: "30", PAID_REQUESTS_PER_HOUR: "100" })).toEqual({ perNetwork: 30, site: 100 });
    expect(paidLimits({ PAID_REQUESTS_PER_IP_PER_HOUR: "0", PAID_REQUESTS_PER_HOUR: "lots" })).toEqual({ perNetwork: 120, site: 600 });
  });

  it("fails open when the table is missing", async () => {
    const failing = vi.fn(async (sql: string) => {
      if (sql === "BEGIN" || sql === "ROLLBACK" || sql.startsWith("SELECT pg_advisory")) return { rows: [] };
      throw Object.assign(new Error("missing"), { code: "42P01" });
    });
    database = { query: failing, connect: async () => ({ query: failing, release: () => undefined }) } as never;
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(assertPaidRequestAllowed(request("1.1.1.1"))).resolves.toBeUndefined();
    errors.mockRestore();
  });
});

const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 8 });

describe.skipIf(!process.env.TEST_DATABASE_URL)("paid request limits (isolated test database)", () => {
  beforeAll(async () => { await pool.query(await readFile(new URL("../db/schema.sql", import.meta.url), "utf8")); });
  beforeEach(async () => { database = pool; await pool.query("DELETE FROM rate_limit_events"); });
  afterAll(async () => { await pool.query("DELETE FROM rate_limit_events"); await pool.end(); });

  it("blocks one network after its hourly limit without affecting others", async () => {
    const limits = { perNetwork: 3, site: 100 };
    const ip = `10.${Math.floor(Math.random() * 200)}.0.1`;
    for (let i = 0; i < 3; i++) await assertPaidRequestAllowed(request(ip), limits);
    await expect(assertPaidRequestAllowed(request(ip), limits)).rejects.toMatchObject({ status: 429, code: "RATE_LIMITED" });
    await expect(assertPaidRequestAllowed(request("10.250.0.2"), limits)).resolves.toBeUndefined();
  });

  it("caps the whole site across networks", async () => {
    const limits = { perNetwork: 100, site: 4 };
    for (let i = 0; i < 4; i++) await assertPaidRequestAllowed(request(`172.16.0.${i}`), limits);
    await expect(assertPaidRequestAllowed(request("172.16.0.99"), limits)).rejects.toMatchObject({ status: 503, code: "SITE_BUSY" });
  });

  it("does not let concurrent requests overshoot", async () => {
    const limits = { perNetwork: 5, site: 100 };
    const results = await Promise.allSettled(Array.from({ length: 20 }, () => assertPaidRequestAllowed(request("192.168.7.7"), limits)));
    const allowed = results.filter((result) => result.status === "fulfilled").length;
    expect(allowed).toBe(5);
  });

  it("counts only the last hour", async () => {
    const limits = { perNetwork: 1, site: 100 };
    const key = networkKey("203.0.113.5");
    await pool.query("INSERT INTO rate_limit_events (key_hash, created_at) VALUES ($1, now() - interval '2 hours')", [key]);
    await expect(assertPaidRequestAllowed(request("203.0.113.5"), limits)).resolves.toBeUndefined();
  });
});
