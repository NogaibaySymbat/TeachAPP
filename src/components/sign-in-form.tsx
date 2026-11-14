"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { getAuthClient } from "@/lib/auth-client";
import { loginWithGoogle } from "@/lib/auth-flow";

function MailIcon() {
  return <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7 8 6 8-6" /></svg>;
}

export function SignInForm() {
  const [step, setStep] = useState<"choose" | "email" | "sent">("choose");
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [pending, setPending] = useState<"email" | "google" | null>(null);
  const [error, setError] = useState("");
  const emailInput = useRef<HTMLInputElement>(null);
  const emailButton = useRef<HTMLButtonElement>(null);
  const successHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (step === "email") emailInput.current?.focus();
    if (step === "sent") successHeading.current?.focus();
  }, [step]);

  function backToMethods() {
    setStep("choose");
    setError("");
    requestAnimationFrame(() => emailButton.current?.focus());
  }

  async function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const client = getAuthClient();
    if (!client) {
      setError("Вход по email пока недоступен. Попробуйте позже.");
      return;
    }
    setPending("email");
    try {
      const address = email.trim();
      const { error: signInError } = await client.auth.signInWithOtp({
        email: address,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback`, shouldCreateUser: true },
      });
      if (signInError) throw signInError;
      setSentTo(address);
      setStep("sent");
    } catch {
      setError("Не удалось отправить ссылку. Проверьте адрес и попробуйте ещё раз через минуту.");
    } finally { setPending(null); }
  }

  async function signInWithGoogle() {
    setError("");
    setPending("google");
    try {
      await loginWithGoogle();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось открыть Google. Попробуйте ещё раз.");
      setPending(null);
    }
  }

  return (
    <section className="login-screen" aria-labelledby="login-title">
      <Link className="login-close" href="/" aria-label="Закрыть вход и вернуться к темам">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
      </Link>
      <div className="login-content">
        {step === "choose" ? (
          <>
            <h1 id="login-title">Войдите в <span className="login-brand">TeachAPP</span></h1>
            <p className="login-intro">Сохраняйте занятия и возвращайтесь к своей истории.</p>
            <div className="login-methods" aria-busy={pending !== null}>
              <button ref={emailButton} className="login-method" disabled={pending !== null} onClick={() => { setError(""); setStep("email"); }}>
                <span className="login-method-icon"><MailIcon /></span><span>Войти по email</span>
              </button>
              <button className="login-method" disabled={pending !== null} onClick={() => void signInWithGoogle()}>
                <span className="login-method-icon login-google-icon"><Image src="/icons/google.png" width={24} height={24} alt="" unoptimized /></span><span>{pending === "google" ? "Открываем Google…" : "Продолжить с Google"}</span>
              </button>
            </div>
          </>
        ) : step === "email" ? (
          <>
            <button type="button" className="login-back" onClick={backToMethods} disabled={pending !== null}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m14 6-6 6 6 6M8 12h13" /></svg>Все способы входа
            </button>
            <h1 id="login-title">Войти по email</h1>
            <p className="login-intro">Пришлём ссылку для входа.<br />Пароль не нужен.</p>
            <form className="login-email-form" onSubmit={(event) => void submitEmail(event)} aria-busy={pending === "email"}>
              <label htmlFor="login-email">Электронная почта</label>
              <input ref={emailInput} id="login-email" name="email" type="email" autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} disabled={pending !== null} aria-describedby={error ? "login-error" : undefined} />
              <button className="login-submit" type="submit" disabled={pending !== null}>{pending === "email" ? "Отправляем ссылку…" : "Получить ссылку"}</button>
            </form>
          </>
        ) : (
          <>
            <h1 ref={successHeading} id="login-title" tabIndex={-1}>Проверьте почту</h1>
            <p className="login-intro">Отправили ссылку на <strong className="login-email-address">{sentTo}</strong></p>
            <p className="login-help">Откройте письмо в этом браузере, чтобы сохранить в аккаунте гостевые занятия.</p>
            <button className="login-method" onClick={() => { setError(""); setStep("email"); }}>Изменить email или отправить ещё раз</button>
          </>
        )}
        {error && <p id="login-error" className="login-error" role="alert">{error}</p>}
      </div>
      <div className="login-bottom">
        <p>Впервые здесь? <span>Аккаунт создастся при первом входе.</span></p>
      </div>
    </section>
  );
}
