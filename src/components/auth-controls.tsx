"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { signOutLocally } from "@/lib/auth-flow";

export function AuthControls() {
  const { account, loading, error, refresh } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");

  async function signOut() {
    setSigningOut(true);
    setSignOutError("");
    try {
      await signOutLocally();
    } catch {
      setSigningOut(false);
      setSignOutError("Не удалось выйти. Попробуйте ещё раз.");
    }
  }

  return (
    <div className="auth-controls" lang="ru">
      {loading ? <span className="browser-note" role="status">Проверяем аккаунт…</span> : error ? (
        <div className="auth-status auth-error" role="alert"><p>{error}</p><div className="auth-controls-actions"><Link href="/login">Войти снова</Link><button className="secondary" onClick={() => void refresh()}>Повторить</button></div></div>
      ) : account ? (
        <div className="auth-controls-actions"><span className="account-email">{account.label}</span><button className="secondary" onClick={() => void signOut()} disabled={signingOut}>{signingOut ? "Выходим…" : "Выйти"}</button></div>
      ) : (
        <div className="auth-controls-guest"><Link href="/login">Войти</Link><p className="browser-note">Чтобы получить доступ к истории, войдите в аккаунт.</p></div>
      )}
      {signOutError && <p className="auth-status auth-error" role="alert">{signOutError}</p>}
    </div>
  );
}
