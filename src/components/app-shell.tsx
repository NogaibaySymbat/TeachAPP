"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthControls } from "@/components/auth-controls";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuth = pathname === "/login" || pathname === "/auth/callback";
  if (isAuth) return <div className="auth-shell" lang="ru"><a className="skip-link" href="#main">Перейти к содержимому</a><main id="main">{children}</main></div>;
  return <><a className="skip-link" href="#main">Skip to content</a><header className="site-header"><Link className="wordmark" href="/">TeachAPP<span>Study workspace</span></Link><AuthControls /></header><main id="main">{children}</main><footer>Explain it in your own words. See what stays.</footer></>;
}
