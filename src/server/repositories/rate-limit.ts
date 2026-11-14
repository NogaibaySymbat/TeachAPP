import "server-only";
import { createHash, createHmac } from "node:crypto";
import { getDatabase } from "@/server/db";
import { ServiceError } from "@/server/errors";

// Limits paid AI operations (student replies, notebooks, exams, speech) per
// network and for the whole site, so a script cannot drain the shared budget.
// Judges often share one venue network, so the per-network limit is generous.
const DEFAULT_PER_NETWORK_PER_HOUR = 120;
const DEFAULT_SITE_PER_HOUR = 600;

function readLimit(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return value?.trim() && Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function paidLimits(env: Record<string, string | undefined> = process.env) {
  return {
    perNetwork: readLimit(env.PAID_REQUESTS_PER_IP_PER_HOUR, DEFAULT_PER_NETWORK_PER_HOUR),
    site: readLimit(env.PAID_REQUESTS_PER_HOUR, DEFAULT_SITE_PER_HOUR),
  };
}

// Vercel sets these headers at its edge; locally they are usually absent.
export function clientAddress(request: Request): string {
  const real = request.headers.get("x-real-ip")?.trim();
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return real || forwarded || "unknown";
}

// Only a keyed hash of the address is stored, never the address itself.
export function networkKey(address: string, secret = process.env.AUTH_SECRET): string {
  return secret
    ? createHmac("sha256", secret).update(address).digest("hex").slice(0, 32)
    : createHash("sha256").update(address).digest("hex").slice(0, 32);
}

interface LimitRow { mine: string; total: string; allowed: boolean }

export async function assertPaidRequestAllowed(request: Request, limits = paidLimits()): Promise<void> {
  const key = networkKey(clientAddress(request));
  let row: LimitRow;
  try {
    const client = await getDatabase().connect();
    try {
      await client.query("BEGIN");
      // One short transaction lock serializes check-and-insert, so concurrent
      // requests cannot overshoot the limits (the same pattern as ai_usage).
      await client.query("SELECT pg_advisory_xact_lock(163431, 0)");
      const counts = await client.query<{ mine: string; total: string }>(
        `SELECT count(*) FILTER (WHERE key_hash = $1)::text AS mine, count(*)::text AS total
         FROM rate_limit_events WHERE created_at > now() - interval '1 hour'`,
        [key],
      );
      const mine = Number(counts.rows[0].mine);
      const total = Number(counts.rows[0].total);
      const allowed = mine < limits.perNetwork && total < limits.site;
      if (allowed) await client.query("INSERT INTO rate_limit_events (key_hash) VALUES ($1)", [key]);
      await client.query("COMMIT");
      row = { mine: String(mine), total: String(total), allowed };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    // Fail open: a missing table or a database hiccup must not break learning.
    // The durable AI budget ledger still caps total spending.
    console.error("Rate limit check skipped.", { code: (error as { code?: string }).code });
    return;
  }
  if (row.allowed) {
    // Occasional cleanup keeps the table small; failures here are harmless.
    if (Math.random() < 0.02) {
      void getDatabase().query("DELETE FROM rate_limit_events WHERE created_at < now() - interval '1 day'").catch(() => undefined);
    }
    return;
  }
  if (Number(row.mine) >= limits.perNetwork) {
    throw new ServiceError(429, "RATE_LIMITED", "Too many requests from this network. Please wait a few minutes; your work is saved.");
  }
  throw new ServiceError(503, "SITE_BUSY", "TeachAPP is very busy right now. Please try again in a few minutes; your work is saved.");
}
