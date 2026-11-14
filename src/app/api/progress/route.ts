import { requestIdentity } from "@/server/auth";
import type { Progress } from "@/lib/types";
import { handle } from "@/server/http";
import { getProgressGaps, getStreak } from "@/server/repositories/progress";

export async function GET(request: Request) {
  return handle(async () => {
    const userId = await requestIdentity(request);
    const [streak, gaps] = await Promise.all([getStreak(userId), getProgressGaps(userId)]);
    return Response.json({ streak, topicOfTheDay: null, gaps } satisfies Progress);
  });
}
