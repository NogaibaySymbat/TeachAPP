import { AuthCallback } from "@/components/auth-callback";
import Link from "next/link";

export default function AuthCallbackPage() {
  return (
    <section className="login-screen" aria-labelledby="callback-title">
      <Link className="login-close" href="/" aria-label="Закрыть вход и вернуться к темам"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></Link>
      <div className="login-content login-callback"><h1 id="callback-title">Возвращаемся к занятиям</h1><AuthCallback /></div>
    </section>
  );
}
