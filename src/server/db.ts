import "server-only";
import { Pool } from "pg";
import { ServiceError } from "./errors";

const globalDatabase = globalThis as unknown as { databasePool?: Pool };

export function getDatabase(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new ServiceError(503, "DATABASE_UNAVAILABLE", "Storage is unavailable. Please try again later.");
  }
  if (!globalDatabase.databasePool) {
    globalDatabase.databasePool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    });
    globalDatabase.databasePool.on("error", () => console.error("An idle database connection failed."));
  }
  return globalDatabase.databasePool;
}
