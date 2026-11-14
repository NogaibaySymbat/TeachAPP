import { existsSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const config = new URL("../.env.local", import.meta.url);
if (existsSync(config)) {
  console.log("Existing .env.local preserved. Local database: port 55433, database teachapp.");
} else {
  writeFileSync(config, [
    "DATABASE_URL=postgresql://teachapp@127.0.0.1:55433/teachapp",
    "DEMO_AUTH_ENABLED=true",
    `AUTH_SECRET=${randomBytes(32).toString("hex")}`,
    "NEXT_PUBLIC_SUPABASE_URL=",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=",
    "",
  ].join("\n"), { mode: 0o600 });
  console.log("Created .env.local. Local demo sign-in: admin / admin. Configure Supabase for Email and Google; secrets stay in this ignored file.");
}
