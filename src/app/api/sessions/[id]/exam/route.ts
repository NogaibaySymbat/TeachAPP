import { z } from "zod";
import type { ExamResponse } from "@/lib/types";
import { handle, readBody, sessionId, type SessionRouteContext } from "@/server/http";
import { learningIdentity } from "@/server/learning-http";
import { assertPaidRequestAllowed } from "@/server/repositories/rate-limit";
import { runPracticeExam } from "@/server/learning";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request, context: SessionRouteContext) {
  return handle(async () => {
    const userId = await learningIdentity(request);
    await assertPaidRequestAllowed(request);
    const id = sessionId((await context.params).id);
    await readBody(request, z.object({}).strict());
    return Response.json({ attempt: await runPracticeExam(userId, id) } satisfies ExamResponse);
  });
}
