import "server-only";
import { z } from "zod";
import { ServiceError } from "./errors";
import { errorDiagnostic } from "./error-diagnostic";

export type SessionRouteContext = { params: Promise<{ id: string }> };

export function anonymousId(request: Request): string {
  const result = z.uuid().safeParse(request.headers.get("x-anonymous-id"));
  if (!result.success) throw new ServiceError(400, "INVALID_ANONYMOUS_ID", "A valid anonymous browser ID is required.");
  return result.data;
}

export function sessionId(id: string): string {
  if (!z.uuid().safeParse(id).success) throw new ServiceError(400, "INVALID_SESSION_ID", "The session ID is invalid.");
  return id;
}

export async function readBody<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > 32_768) throw new ServiceError(413, "BODY_TOO_LARGE", "Please send a shorter message.");
  let value: unknown;
  try { value = JSON.parse(body); }
  catch { throw new ServiceError(400, "INVALID_JSON", "The request must contain valid JSON."); }
  const result = schema.safeParse(value);
  if (!result.success) throw new ServiceError(400, "INVALID_REQUEST", "Please check the request fields and try again.");
  return result.data;
}

export async function handle(work: () => Promise<Response>): Promise<Response> {
  try {
    const response = await work();
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    const known = error instanceof ServiceError;
    if (!known) console.error("API request failed.", errorDiagnostic(error));
    return Response.json({ error: {
      code: known ? error.code : "INTERNAL_ERROR",
      message: known ? error.message : "Something went wrong. Please try again later.",
    } }, { status: known ? error.status : 500, headers: { "Cache-Control": "no-store" } });
  }
}

export function aiUnavailable(): never {
  throw new ServiceError(501, "AI_NOT_CONNECTED", "Your student is taking a short break. Your explanation is saved; come back in a little while and they will pick up right here.");
}
