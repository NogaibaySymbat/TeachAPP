import "server-only";
import type { Message } from "@/lib/types";
import { completeStudentReply } from "@/ai/student";
import { claimStudentReply, failStudentReply, finishStudentReply } from "./repositories/student-replies";

export async function replyToExplanation(userId: string, sessionId: string, messageId: string): Promise<Message> {
  const claim = await claimStudentReply(userId, sessionId, messageId);
  if (claim.kind === "completed") return claim.message;
  try {
    const text = await completeStudentReply({ topicId: claim.topicId, history: claim.history, notebook: [] });
    return await finishStudentReply(userId, sessionId, messageId, claim.attemptToken, text);
  } catch (error) {
    // A failed database update leaves the lease intact; an explicit retry can
    // recover it after expiry. Provider budget reservations are never released.
    await failStudentReply(sessionId, messageId, claim.attemptToken).catch(() => undefined);
    throw error;
  }
}
