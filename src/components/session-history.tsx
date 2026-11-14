"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { SessionHistoryResponse } from "@/lib/types";
import { useAuth } from "@/components/auth-provider";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function SessionHistory() {
  const { account, loading, error, refresh } = useAuth();

  return (
    <section className="session-history" aria-labelledby="history-title" lang="ru">
      <div className="section-heading"><h2 id="history-title">История занятий</h2></div>
      {loading ? <p className="empty-state" role="status">Проверяем аккаунт…</p> : error ? (
        <div className="notice error" role="alert"><p>{error}</p><button className="secondary" onClick={() => void refresh()}>Повторить</button></div>
      ) : account ? <AccountHistory key={account.id} /> : (
        <div className="empty-state history-sign-in"><p>Чтобы получить доступ к истории, войдите в аккаунт.</p><Link href="/login">Войти в аккаунт</Link></div>
      )}
    </section>
  );
}

function AccountHistory() {
  const [history, setHistory] = useState<SessionHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryOffset, setRetryOffset] = useState(0);
  const loadSequence = useRef(0);

  const load = useCallback(async (offset: number, signal?: AbortSignal) => {
    const sequence = ++loadSequence.current;
    setLoading(true);
    setError("");
    try {
      const response = await api<SessionHistoryResponse>(`/api/sessions?offset=${offset}`, { signal });
      if (signal?.aborted || sequence !== loadSequence.current) return;
      setHistory((previous) => {
        const sessions = offset === 0 ? response.sessions : [...(previous?.sessions ?? []), ...response.sessions];
        return {
          sessions: Array.from(new Map(sessions.map((session) => [session.id, session])).values()),
          nextOffset: response.nextOffset,
        };
      });
    } catch (cause) {
      if (!signal?.aborted && sequence === loadSequence.current) {
        setRetryOffset(offset);
        setError(cause instanceof Error ? cause.message : "Не удалось загрузить историю занятий. Попробуйте ещё раз.");
      }
    } finally {
      if (!signal?.aborted && sequence === loadSequence.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let controller = new AbortController();
    void load(0, controller.signal);
    const refresh = () => {
      controller.abort();
      controller = new AbortController();
      void load(0, controller.signal);
    };
    window.addEventListener("study-history-updated", refresh);
    return () => {
      loadSequence.current += 1;
      controller.abort();
      window.removeEventListener("study-history-updated", refresh);
    };
  }, [load]);

  return (
    <div aria-busy={loading}>
      {error && (
        <div className="notice error" role="alert">
          <p>{error}</p>
          <button className="secondary" onClick={() => void load(retryOffset)} disabled={loading}>Попробовать ещё раз</button>
        </div>
      )}
      {!history && loading && <p className="empty-state" role="status">Загружаем историю занятий…</p>}
      {history?.sessions.length === 0 && (
        <div className="empty-state"><h3>У вас пока нет занятий</h3><p>Начните занятие с доступной темы. Оно появится здесь, и вы сможете вернуться к нему позже.</p></div>
      )}
      {!!history?.sessions.length && (
        <ul className="session-history-list">
          {history.sessions.map((session) => (
            <li key={session.id}>
              <Link href={`/session/${session.id}`} className="session-history-link">
                <div>
                  <h3>{session.topicTitle}</h3>
                  <p>Последняя активность: <time dateTime={session.lastActivityAt}>{formatDate(session.lastActivityAt)}</time></p>
                  <p>Сообщений: {session.messageCount}</p>
                </div>
                <span className="session-history-result">{session.latestAttempt ? `Последний экзамен: ${session.latestAttempt.score}/${session.latestAttempt.total}` : "Экзамен ещё не пройден"}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {history?.nextOffset != null && !error && (
        <button className="secondary session-history-more" onClick={() => void load(history.nextOffset ?? 0)} disabled={loading}>
          {loading ? "Загружаем…" : "Показать ещё"}
        </button>
      )}
    </div>
  );
}
