import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { ServiceError } from "./errors";

export const DEMO_COOKIE_NAME = "businesscup26.demo-session";
export const DEMO_SESSION_SECONDS = 8 * 60 * 60;

const payloadSchema = z.object({
  version: z.literal(1),
  accountId: z.uuid(),
  issuedAt: z.number().int().nonnegative(),
  expiresAt: z.number().int().nonnegative(),
  nonce: z.string().regex(/^[a-f0-9]{32}$/),
}).strict();

export function demoLoginAvailable(): boolean {
  return process.env.DEMO_AUTH_ENABLED === "true" && (process.env.AUTH_SECRET?.length ?? 0) >= 32;
}

function secret(): string {
  if (!demoLoginAvailable()) {
    throw new ServiceError(503, "DEMO_AUTH_UNAVAILABLE", "Временный вход сейчас недоступен.");
  }
  return process.env.AUTH_SECRET!;
}

export function assertSameOrigin(request: Request): void {
  const url = new URL(request.url);
  // Next may normalize request.url to its listening hostname. Host preserves
  // the browser's actual destination; forwarded-host is not trusted here.
  const expectedOrigin = `${url.protocol}//${request.headers.get("host") ?? url.host}`;
  if (request.headers.get("origin") !== expectedOrigin) {
    throw new ServiceError(403, "INVALID_ORIGIN", "Откройте форму входа на этом сайте и попробуйте ещё раз.");
  }
}

export function assertDemoCredentials(username: string, password: string): void {
  secret();
  // Hash both values to fixed-length buffers before comparison.
  const digest = (value: string) => createHmac("sha256", secret()).update(value).digest();
  const validUsername = timingSafeEqual(digest(username), digest("admin"));
  const validPassword = timingSafeEqual(digest(password), digest("admin"));
  if (!validUsername || !validPassword) {
    throw new ServiceError(401, "INVALID_CREDENTIALS", "Неверный логин или пароль.");
  }
}

export function createDemoToken(accountId: string, now = Date.now()): string {
  const issuedAt = Math.floor(now / 1000);
  const payload = payloadSchema.parse({
    version: 1, accountId, issuedAt, expiresAt: issuedAt + DEMO_SESSION_SECONDS,
    nonce: randomBytes(16).toString("hex"),
  });
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function cookieValue(request: Request): string | null {
  const values = (request.headers.get("cookie") ?? "").split(";")
    .map((part) => part.trim()).filter((part) => part.startsWith(`${DEMO_COOKIE_NAME}=`));
  if (values.length === 0) return null;
  if (values.length !== 1) throw invalidSession();
  return values[0].slice(DEMO_COOKIE_NAME.length + 1);
}

function invalidSession(): ServiceError {
  return new ServiceError(401, "AUTH_REQUIRED", "Сессия завершилась. Войдите в аккаунт снова.");
}

export function hasDemoCookie(request: Request): boolean {
  return cookieValue(request) !== null;
}

export function readDemoAccountId(request: Request, now = Date.now()): string | null {
  const token = cookieValue(request);
  if (token === null) return null;
  if (!demoLoginAvailable() || token.length > 1024) throw invalidSession();
  const parts = token.split(".");
  if (parts.length !== 2 || !parts.every((part) => /^[A-Za-z0-9_-]+$/.test(part))) throw invalidSession();
  const expected = createHmac("sha256", secret()).update(parts[0]).digest();
  const supplied = Buffer.from(parts[1], "base64url");
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw invalidSession();
  let raw: unknown;
  try { raw = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")); }
  catch { throw invalidSession(); }
  const parsed = payloadSchema.safeParse(raw);
  const current = Math.floor(now / 1000);
  if (!parsed.success || parsed.data.expiresAt <= current || parsed.data.issuedAt > current + 60
    || parsed.data.expiresAt - parsed.data.issuedAt !== DEMO_SESSION_SECONDS) throw invalidSession();
  return parsed.data.accountId;
}

export function demoSessionCookie(request: Request, token: string | null): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${DEMO_COOKIE_NAME}=${token ?? ""}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${token ? DEMO_SESSION_SECONDS : 0}${secure}`;
}
