import { requestIdentity } from "@/server/auth";
import { z } from "zod";
import type { SendMessageResponse } from "@/lib/types";
import { handle, readBody, sessionId, type SessionRouteContext } from "@/server/http";
import { saveMessage } from "@/server/repositories/messages";

export async function POST(request: Request, context: SessionRouteContext) {
  return handle(async () => {
    const userId = await requestIdentity(request);
    const id = sessionId((await context.params).id);
    const { text } = await readBody(request, z.object({ text: z.string().trim().min(1).max(10000) }).strict());
    return Response.json({ message: await saveMessage(userId, id, text) } satisfies SendMessageResponse, { status: 201 });
  });
}
