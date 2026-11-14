import "server-only";

// Log only fixed labels. Error messages, names, stack traces and database
// metadata may contain user text, SQL, credentials or connection URLs.
const codes = new Map<string, string>([
  ...[
    "ECONNRESET", "ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "ETIMEDOUT",
    "EHOSTUNREACH", "ENETUNREACH", "EPIPE",
  ].map((code): [string, string] => [code, `network:${code}`]),
  ...[
    "CERT_HAS_EXPIRED", "CERT_NOT_YET_VALID", "DEPTH_ZERO_SELF_SIGNED_CERT",
    "SELF_SIGNED_CERT_IN_CHAIN", "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
    "UNABLE_TO_GET_ISSUER_CERT_LOCALLY", "ERR_TLS_CERT_ALTNAME_INVALID",
    "ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR",
  ].map((code): [string, string] => [code, `tls:${code}`]),
  ...[
    "28P01", "28000", "3D000", "42501", "42P01", "42703", "23503", "23505",
    "40001", "40P01", "53300", "57P01", "57P02", "57P03", "08000", "08003",
    "08006", "08001", "08004", "08007", "08P01",
  ].map((code): [string, string] => [code, `postgres:${code}`]),
]);

const messages = new Map([
  ["timeout exceeded when trying to connect", "database:connection-timeout"],
  ["Connection terminated due to connection timeout", "database:connection-timeout"],
  ["timeout expired", "database:connection-timeout"],
  ["Query read timeout", "database:query-timeout"],
  ["Connection terminated unexpectedly", "database:connection-terminated"],
  ["The server does not support SSL connections", "database:tls-unsupported"],
  ["There was an error establishing an SSL connection", "database:tls-negotiation"],
]);

export function errorDiagnostic(error: unknown): string {
  const pending = [error];
  // Bound traversal, including cyclic causes and large aggregate errors.
  for (let index = 0; index < pending.length && index < 5; index++) {
    const current = pending[index];
    if (!(current instanceof Error)) continue;
    const code = "code" in current ? current.code : undefined;
    if (typeof code === "string" && codes.has(code)) return codes.get(code)!;
    const label = messages.get(current.message);
    if (label) return label;
    if (current.cause) pending.push(current.cause);
    if (current instanceof AggregateError) pending.push(...current.errors.slice(0, 4));
  }
  return "unknown";
}
