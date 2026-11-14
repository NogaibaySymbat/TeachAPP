import { requestIdentity } from "@/server/auth";
import type { SessionResponse } from "@/lib/types";
import { handle, sessionId, type SessionRouteContext } from "@/server/http";
import { findSession } from "@/server/repositories/sessions";
import { getMessages } from "@/server/repositories/messages";
import { getNotebook } from "@/server/repositories/notebook";

export async function GET(request: Request, context: SessionRouteContext) {
  return handle(async () => {
    const userId = await requestIdentity(request);
    const id = sessionId((await context.params).id);
    const session = await findSession(userId, id);
    const [messages, notebook] = await Promise.all([getMessages(userId, id), getNotebook(userId, id)]);
    return Response.json({ session, messages, notebook } satisfies SessionResponse);
  });
}
