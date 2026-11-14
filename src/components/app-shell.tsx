import Link from "next/link";

export function AppShell({ children }: { children: React.ReactNode }) {
  return <><a className="skip-link" href="#main">Skip to content</a><header className="site-header"><Link className="wordmark" href="/">TeachAPP<span>Study workspace</span></Link><span className="browser-note" lang="ru">Ваше пространство в этом браузере</span></header><main id="main">{children}</main><footer>Explain it in your own words. See what stays.</footer></>;
}
