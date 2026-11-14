import { requestIdentity } from "@/server/auth";
import { z } from "zod";
import type { CreateSessionResponse, SessionHistoryResponse } from "@/lib/types";
import { getTopic, getTopics } from "@/server/content";
import { handle, readBody } from "@/server/http";
import { createSession, listSessions } from "@/server/repositories/sessions";
import { ServiceError } from "@/server/errors";

export async function GET(request: Request) {
  return handle(async () => {
    const userId = await requestIdentity(request);
    const offset = z.coerce.number().int().min(0).max(100000).safeParse(new URL(request.url).searchParams.get("offset") ?? "0");
    if (!offset.success) throw new ServiceError(400, "INVALID_OFFSET", "The history page is invalid.");
    const [history, topics] = await Promise.all([listSessions(userId, offset.data), getTopics()]);
    return Response.json({
      ...history,
      sessions: history.sessions.map((session) => ({
        ...session,
        topicTitle: topics.find((topic) => topic.id === session.topicId)?.title ?? "Archived topic",
      })),
    } satisfies SessionHistoryResponse);
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const userId = await requestIdentity(request);
    const { topicId } = await readBody(request, z.object({ topicId: z.string().min(1).max(100) }).strict());
    await getTopic(topicId);
    const session = await createSession(userId, topicId);
    return Response.json({ sessionId: session.id, firstMessage: null } satisfies CreateSessionResponse, { status: 201 });
  });
}
