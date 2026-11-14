import { z } from "zod";
import type { DebriefResponse } from "@/lib/types";
import { requestIdentity } from "@/server/auth";
import { ServiceError } from "@/server/errors";
import { handle, readBody, sessionId, type SessionRouteContext } from "@/server/http";
import { learningIdentity } from "@/server/learning-http";
import { getSavedDebrief } from "@/server/repositories/learning";

export const runtime = "nodejs";

export async function GET(request: Request, context: SessionRouteContext) {
  return handle(async () => {
    const userId = await requestIdentity(request);
    const id = sessionId((await context.params).id);
    const parsed = z.uuid().optional().safeParse(new URL(request.url).searchParams.get("attemptId") ?? undefined);
    if (!parsed.success) throw new ServiceError(400, "INVALID_REQUEST", "Choose a saved practice attempt.");
    return Response.json(await getSavedDebrief(userId, id, parsed.data) satisfies DebriefResponse);
  });
}
// Kept for explicit review/retry controls. Reviews are saved during grading;
// neither GET nor POST starts a model call or changes the saved evidence.
export async function POST(request: Request, context: SessionRouteContext) {
  return handle(async () => {
    const userId = await learningIdentity(request);
    const id = sessionId((await context.params).id);
    const { attemptId } = await readBody(request, z.object({ attemptId: z.uuid().optional() }).strict());
    return Response.json(await getSavedDebrief(userId, id, attemptId) satisfies DebriefResponse);
  });
}
