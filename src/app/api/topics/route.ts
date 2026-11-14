import { requestIdentity } from "@/server/auth";
import { handle } from "@/server/http";
import { getTopicSummaries } from "@/server/repositories/progress";

export async function GET(request: Request) {
  return handle(async () => Response.json(await getTopicSummaries(await requestIdentity(request))));
}
