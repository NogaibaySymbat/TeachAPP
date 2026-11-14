import { requestIdentity } from "@/server/auth";
import type { Progress } from "@/lib/types";
import { pickTopicOfTheDay } from "@/ai/planner";
import { handle } from "@/server/http";
import { getProgressGaps, getStreak, getTopicSummaries } from "@/server/repositories/progress";

export async function GET(request: Request) {
  return handle(async () => {
    const userId = await requestIdentity(request);
    const [streak, gaps, topics] = await Promise.all([getStreak(userId), getProgressGaps(userId), getTopicSummaries(userId)]);
    return Response.json({ streak, topicOfTheDay: pickTopicOfTheDay(topics), gaps } satisfies Progress);
  });
}
