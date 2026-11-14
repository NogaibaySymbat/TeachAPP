import "server-only";
import { requestIdentity } from "./auth";
import { assertSameOrigin } from "./demo-auth";
import { ServiceError } from "./errors";

export async function learningIdentity(request: Request): Promise<string> {
  assertSameOrigin(request);
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new ServiceError(415, "INVALID_CONTENT_TYPE", "Use the practice controls to update your student.");
  }
  return requestIdentity(request);
}
