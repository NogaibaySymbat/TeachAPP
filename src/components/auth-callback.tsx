"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { getAuthClient } from "@/lib/auth-client";
import { linkGuestHistory, verifySignInLink } from "@/lib/auth-flow";

export function AuthCallback() {
  const [status, setStatus] = useState<"checking" | "saving" | "error" | "history-error" | "other-account" | "unavailable">("checking");
  const [error, setError] = useState("");
  const [accountId, setAccountId] = useState<string | null>(null);
  const signInAttempt = useRef<Promise<string> | null>(null);

  const saveHistory = useCallback(async (id: string) => {
    setStatus("saving");
    setError("");
    try {
      const result = await linkGuestHistory(id);
      if (result === "other-account") { setStatus("other-account"); return; }
      window.location.replace("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось сохранить гостевую историю. Повторите попытку.");
      setStatus("history-error");
    }
  }, []);

  useEffect(() => {
    let active = true;
    const client = getAuthClient();
    if (!client) { setStatus("unavailable"); return; }
    signInAttempt.current ??= verifySignInLink();
    void signInAttempt.current.then(async (id) => {
      if (!active) return;
      setAccountId(id);
      await saveHistory(id);
    }).catch((cause) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Не удалось подтвердить вход. Выберите способ входа и попробуйте ещё раз.");
          setStatus("error");
        }
    });
    return () => { active = false; };
  }, [saveHistory]);

  if (status === "unavailable") return <div className="notice" lang="ru"><h2>Вход пока недоступен</h2><p>Попробуйте позже или вернитесь к занятиям.</p><Link href="/">На главную</Link></div>;
  if (status === "checking" || status === "saving") return <p className="notice" role="status" lang="ru">{status === "checking" ? "Подтверждаем вход…" : "Сохраняем гостевые занятия в аккаунт…"}</p>;
  if (status === "other-account") return <div className="notice" lang="ru"><h2>Вы вошли в аккаунт</h2><p>Предыдущая история в этом браузере принадлежит другому аккаунту и не была перенесена.</p><Link href="/">Перейти к занятиям</Link></div>;
  return (
    <div className="notice error" role="alert" lang="ru">
      <h2>{status === "history-error" ? "Вы вошли. Осталось сохранить историю" : "Не удалось завершить вход"}</h2>
      <p>{error}</p>
      {status === "history-error" && accountId ? <><p>Гостевые занятия сохранены в этом браузере. Повторите перенос перед уходом со страницы.</p><button className="secondary" onClick={() => void saveHistory(accountId)}>Повторить перенос</button></> : <Link href="/login">Выбрать способ входа</Link>}
    </div>
  );
}
