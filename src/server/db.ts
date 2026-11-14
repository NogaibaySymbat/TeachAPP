import "server-only";
import { Pool } from "pg";
import { ServiceError } from "./errors";
import { databaseConfig } from "./database-config";
import { errorDiagnostic } from "./error-diagnostic";

const globalDatabase = globalThis as unknown as { databasePool?: Pool };

export function getDatabase(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new ServiceError(503, "DATABASE_UNAVAILABLE", "Storage is unavailable. Please try again later.");
  }
  if (!globalDatabase.databasePool) {
    globalDatabase.databasePool = new Pool(databaseConfig(process.env.DATABASE_URL, process.env.DATABASE_SSL_CA));
    globalDatabase.databasePool.on("error", (error) => console.error("An idle database connection failed.", errorDiagnostic(error)));
  }
  return globalDatabase.databasePool;
}
