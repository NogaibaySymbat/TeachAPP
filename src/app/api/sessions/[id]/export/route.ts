import { requestIdentity } from "@/server/auth";
import { handle, sessionId, type SessionRouteContext } from "@/server/http";
import { exportSession } from "@/server/learning";

export const runtime = "nodejs";

export async function GET(request: Request, context: SessionRouteContext) {
  return handle(async () => {
    const userId = await requestIdentity(request);
    const id = sessionId((await context.params).id);
    return Response.json(await exportSession(userId, id), {
      headers: { "Content-Disposition": `attachment; filename="teachapp-${id}.json"`, "X-Content-Type-Options": "nosniff" },
    });
  });
}
