import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { AuthProvider } from "@/components/auth-provider";
import { demoLoginAvailable } from "@/server/demo-auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "TeachAPP · Study workspace",
  description: "Explain a topic, build your student's notebook, and see what they learned.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider initialDemoAvailable={demoLoginAvailable()}>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
