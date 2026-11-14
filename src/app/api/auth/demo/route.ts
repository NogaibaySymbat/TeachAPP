import { z } from "zod";
import { assertDemoCredentials, assertSameOrigin, createDemoToken, demoSessionCookie } from "@/server/demo-auth";
import { ServiceError } from "@/server/errors";
import { handle, readBody } from "@/server/http";
import { getOrCreateDemoAccount } from "@/server/repositories/accounts";

export async function POST(request: Request) {
  return handle(async () => {
    assertSameOrigin(request);
    if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
      throw new ServiceError(415, "INVALID_CONTENT_TYPE", "Please sign in from the TeachAPP website.");
    }
    const { username, password } = await readBody(request, z.object({
      username: z.string().min(1).max(100), password: z.string().min(1).max(100),
    }).strict());
    assertDemoCredentials(username, password);
    const id = await getOrCreateDemoAccount();
    const token = createDemoToken(id);
    return Response.json({ account: { id, label: "admin", provider: "demo" } }, {
      headers: { "Set-Cookie": demoSessionCookie(request, token) },
    });
  });
}

export async function DELETE(request: Request) {
  return handle(async () => {
    assertSameOrigin(request);
    return Response.json({ ok: true }, { headers: { "Set-Cookie": demoSessionCookie(request, null) } });
  });
}
