import { requestIdentity } from "@/server/auth";
import type { Progress } from "@/lib/types";
import { handle } from "@/server/http";
import { getStreak } from "@/server/repositories/progress";

export async function GET(request: Request) {
  return handle(async () => Response.json({
    streak: await getStreak(await requestIdentity(request)), topicOfTheDay: null, gaps: [],
  } satisfies Progress));
}
