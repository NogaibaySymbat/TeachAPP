import { currentAccount } from "@/server/auth";
import { demoLoginAvailable } from "@/server/demo-auth";
import { handle } from "@/server/http";

export async function GET(request: Request) {
  return handle(async () => Response.json({
    account: await currentAccount(request),
    demoAvailable: demoLoginAvailable(),
  }));
}
