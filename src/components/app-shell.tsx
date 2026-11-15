"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
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
  const [motion, setMotion] = useState(true);
  const mobile = useSyncExternalStore(subscribeSize, mobileSnapshot, serverSnapshot);
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const sidebarToggle = useRef<HTMLButtonElement>(null);
  const moveFocus = useRef(false);
  const contentPanel = useRef<HTMLDivElement>(null);
  const contentOrigin = useRef<number | null>(null);
  const contentAnimation = useRef<Animation | null>(null);

  function changeOpen(next: boolean, animate = true) {
    moveFocus.current = true;
    // Capture the current visual position, including an interrupted transition.
    contentOrigin.current = !mobile && animate && !window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? contentPanel.current?.getBoundingClientRect().left ?? null : null;
    setMotion(animate);
    setOpen(next);
  }
  function close(animate = true) { changeOpen(false, animate); toggle.current?.focus(); }

  useLayoutEffect(() => {
    if (moveFocus.current) {
      moveFocus.current = false;
      if (!mobile) (open ? sidebarToggle : toggle).current?.focus({ preventScroll: true });
    }
    const panel = contentPanel.current;
    const origin = contentOrigin.current;
    contentOrigin.current = null;
    contentAnimation.current?.cancel();
    if (!panel || mobile || origin === null) return;
    const distance = origin - panel.getBoundingClientRect().left;
    if (!distance) return;
    const style = getComputedStyle(panel);
    // Reflow once, then translate: no per-frame width changes or scaled text.
    const animation = panel.animate([{ transform: `translateX(${distance}px)` }, { transform: "translateX(0)" }], {
      duration: parseFloat(style.getPropertyValue("--history-motion-duration")),
      easing: style.getPropertyValue("--ease-drawer").trim(),
    });
    contentAnimation.current = animation;
    return () => animation.cancel();
  }, [open, mobile]);

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
    <div className="sidebar-heading"><Link className="wordmark" href="/" onClick={(event) => { if (mobile) close(event.detail > 0); }}>TeachAPP</Link><button ref={sidebarToggle} className="icon-button secondary" onClick={(event) => close(event.detail > 0)} aria-label="Close history"><PanelIcon /></button></div>
    <Link className="new-session-link" href="/" onClick={(event) => { if (mobile) close(event.detail > 0); }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg> New session</Link>
    <SessionHistory onNavigate={() => { if (mobile) close(false); }} />
    <p className="sidebar-privacy">Saved in this browser. Clearing site data or switching devices removes access to this history.</p>
  </>;

  return <div className={`app-frame${open && !mobile ? " history-open" : ""}`} data-history-motion={motion ? "smooth" : "instant"}>
    <a className="skip-link" href="#main">Skip to content</a>
    {!mobile && <aside id="study-history" className="history-sidebar" aria-label="Session history" aria-hidden={!open} inert={!open} onKeyDown={(event) => { if (event.key === "Escape") close(false); }}>{content}</aside>}
    {mobile && <dialog ref={dialog} id="study-history" className="history-drawer" aria-label="Session history" onCancel={(event) => { event.preventDefault(); close(false); }} onClick={(event) => { if (event.target === event.currentTarget) close(event.detail > 0); }}><div className="drawer-content">{content}</div></dialog>}
    <div ref={contentPanel} className="app-content">
      <header className="site-header"><div className="header-brand"><button ref={toggle} hidden={open && !mobile} className="icon-button secondary" onClick={(event) => changeOpen(!open, event.detail > 0)} aria-label={open ? "Close history" : "Open history"} aria-expanded={open} aria-controls="study-history"><PanelIcon /></button><Link className="wordmark brand-link" href="/"><span className="brand-symbol" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 6c-2-2-6-2-9-1v14c3-1 7-1 9 1 2-2 6-2 9-1V5c-3-1-7-1-9 1Zm0 0v14" /></svg></span><span className="brand-copy">TeachAPP<small>PMP exam prep</small></span></Link></div><div className="header-links"><span className="browser-note">Learn by teaching</span><nav aria-label="Site"><Link href="/pricing" aria-current={pathname === "/pricing" ? "page" : undefined}>Pricing</Link></nav></div></header>
      <main id="main">{children}</main><footer>Learn PMP by explaining it. Practice results do not predict your real exam score.</footer>
    </div>
  </div>;
}
