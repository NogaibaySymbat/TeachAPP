import "server-only";
import { checkServerIdentity, getCACertificates } from "node:tls";
import type { PoolConfig } from "pg";
import { ServiceError } from "./errors";

export function databaseConfig(connectionString: string, certificate?: string): PoolConfig {
  const config: PoolConfig = {
    connectionString,
    max: 5,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
  };
  const ca = certificate?.trim();
  if (!ca) return config;

  let url: URL;
  try {
    url = new URL(connectionString);
    if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") throw new Error();
  } catch {
    // URL parser errors can include the connection string and its password.
    throw new ServiceError(503, "DATABASE_CONFIGURATION_ERROR", "Storage configuration is unavailable.");
  }

  // pg parses connectionString last, so its SSL query parameters would replace
  // the explicit CA (or even disable verification). This mode owns TLS config.
  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase().startsWith("ssl") || key.toLowerCase() === "uselibpqcompat") {
      url.searchParams.delete(key);
    }
  }
  config.connectionString = url.toString();
  // Setting `ca` otherwise replaces Node's trust store. Keep public roots for
  // provider poolers and add the project's private CA for direct connections.
  config.ssl = { ca: [...getCACertificates("default"), ca], rejectUnauthorized: true, checkServerIdentity };
  return config;
}
