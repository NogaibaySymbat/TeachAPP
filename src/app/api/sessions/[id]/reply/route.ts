import { z } from "zod";
import type { StudentReplyResponse } from "@/lib/types";
import { learningIdentity } from "@/server/learning-http";
import { assertPaidRequestAllowed } from "@/server/repositories/rate-limit";
import { handle, readBody, sessionId, type SessionRouteContext } from "@/server/http";
import { replyToExplanation } from "@/server/student-reply";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request, context: SessionRouteContext) {
  return handle(async () => {
    const userId = await learningIdentity(request);
    await assertPaidRequestAllowed(request);
    const id = sessionId((await context.params).id);
    const { messageId } = await readBody(request, z.object({ messageId: z.uuid() }).strict());
    return Response.json({ message: await replyToExplanation(userId, id, messageId) } satisfies StudentReplyResponse);
  });
}
