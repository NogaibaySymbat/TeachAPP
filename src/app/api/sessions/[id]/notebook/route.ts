import { z } from "zod";
import type { NotebookResponse } from "@/lib/types";
import { handle, readBody, sessionId, type SessionRouteContext } from "@/server/http";
import { learningIdentity } from "@/server/learning-http";
import { updateNotebook } from "@/server/learning";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request, context: SessionRouteContext) {
  return handle(async () => {
    const userId = await learningIdentity(request);
    const id = sessionId((await context.params).id);
    await readBody(request, z.object({}).strict());
    return Response.json(await updateNotebook(userId, id) satisfies NotebookResponse);
  });
}
