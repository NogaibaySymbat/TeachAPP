"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { SessionHistory } from "./session-history";

function subscribeSize(callback: () => void) {
  const media = window.matchMedia("(max-width: 760px)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
const mobileSnapshot = () => window.matchMedia("(max-width: 760px)").matches;
const serverSnapshot = () => false;

function PanelIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /></svg>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const mobile = useSyncExternalStore(subscribeSize, mobileSnapshot, serverSnapshot);
  const dialog = useRef<HTMLDialogElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  function close() { setOpen(false); toggle.current?.focus(); }

  useEffect(() => {
    const panel = dialog.current;
    if (!panel) return;
    if (mobile && open) panel.showModal();
    else panel.close();
    if (!mobile || !open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; panel.close(); };
  }, [mobile, open]);

  const content = <>
    <div className="sidebar-heading"><Link className="wordmark" href="/" onClick={() => { if (mobile) close(); }}>TeachAPP</Link><button className="icon-button secondary" onClick={close} aria-label="Close history"><PanelIcon /></button></div>
    <Link className="new-session-link" href="/" onClick={() => { if (mobile) close(); }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg> New session</Link>
    <SessionHistory onNavigate={() => { if (mobile) close(); }} />
    <p className="sidebar-privacy">Saved in this browser. Clearing site data or switching devices removes access to this history.</p>
  </>;

  return <div className={`app-frame${open && !mobile ? " history-open" : ""}`}>
    <a className="skip-link" href="#main">Skip to content</a>
    {!mobile && open && <aside id="study-history" className="history-sidebar" aria-label="Session history" onKeyDown={(event) => { if (event.key === "Escape") close(); }}>{content}</aside>}
    {mobile && <dialog ref={dialog} id="study-history" className="history-drawer" aria-label="Session history" onCancel={() => setOpen(false)} onClick={(event) => { if (event.target === event.currentTarget) close(); }}><div className="drawer-content">{content}</div></dialog>}
    <div className="app-content">
      <header className="site-header"><div className="header-brand"><button ref={toggle} className="icon-button secondary" onClick={() => setOpen(!open)} aria-label={open ? "Close history" : "Open history"} aria-expanded={open} aria-controls={open || mobile ? "study-history" : undefined}><PanelIcon /></button><Link className="wordmark brand-link" href="/"><span className="brand-symbol" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 6c-2-2-6-2-9-1v14c3-1 7-1 9 1 2-2 6-2 9-1V5c-3-1-7-1-9 1Zm0 0v14" /></svg></span><span className="brand-copy">TeachAPP<small>Study workspace</small></span></Link></div><span className="browser-note">Your space to explain.</span></header>
      <main id="main">{children}</main><footer>Explain it in your own words. See what stays.</footer>
    </div>
  </div>;
}
