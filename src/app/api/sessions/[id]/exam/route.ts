import { requestIdentity } from "@/server/auth";
import { aiUnavailable, handle, sessionId, type SessionRouteContext } from "@/server/http";
import { findSession } from "@/server/repositories/sessions";

export async function POST(request: Request, context: SessionRouteContext) {
  return handle(async () => {
    await findSession(await requestIdentity(request), sessionId((await context.params).id));
    return aiUnavailable();
  });
}
