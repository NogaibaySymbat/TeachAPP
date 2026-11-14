import { requireAccount } from "@/server/auth";
import { anonymousId, handle } from "@/server/http";
import { claimGuestHistory } from "@/server/repositories/accounts";

export async function POST(request: Request) {
  return handle(async () => {
    const accountId = await requireAccount(request);
    const guestId = anonymousId(request);
    return Response.json(await claimGuestHistory(accountId, guestId));
  });
}
