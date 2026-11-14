import { z } from "zod";
import { ServiceError } from "@/server/errors";
import { learningIdentity } from "@/server/learning-http";
import { assertPaidRequestAllowed } from "@/server/repositories/rate-limit";
import { handle, readBody, sessionId } from "@/server/http";
import { speakStudentMessage } from "@/server/student-speech";

export const runtime = "nodejs";
export const maxDuration = 30;

type Context = { params: Promise<{ id: string; messageId: string }> };

export async function POST(request: Request, context: Context) {
  return handle(async () => {
    const userId = await learningIdentity(request);
    const params = await context.params;
    const id = sessionId(params.id);
    if (!z.uuid().safeParse(params.messageId).success) {
      throw new ServiceError(400, "INVALID_MESSAGE_ID", "The message ID is invalid.");
    }
    await readBody(request, z.object({}).strict());
    await assertPaidRequestAllowed(request);
    const audio = await speakStudentMessage(userId, id, params.messageId);
    return new Response(Buffer.from(audio), { headers: { "content-type": "audio/mpeg" } });
  });
}
