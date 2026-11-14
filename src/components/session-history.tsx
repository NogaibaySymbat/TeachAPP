"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { SessionHistoryResponse } from "@/lib/types";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function SessionHistory({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
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
        setError(cause instanceof Error ? cause.message : "History could not be loaded. Try again.");
      }
    } finally {
      if (!signal?.aborted && sequence === loadSequence.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let controller = new AbortController();
    queueMicrotask(() => { if (!controller.signal.aborted) void load(0, controller.signal); });
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
  }, [load, pathname]);

  return (
    <section className="session-history" aria-labelledby="history-title" aria-busy={loading}>
      <h2 id="history-title">Recent sessions</h2>
      {error && (
        <div className="notice error" role="alert">
          <p>{error}</p>
          <button className="secondary" onClick={() => void load(retryOffset)} disabled={loading}>Try again</button>
        </div>
      )}
      {!history && loading && <p className="empty-state" role="status">Loading history…</p>}
      {history?.sessions.length === 0 && (
        <div className="empty-state"><h3>No sessions yet</h3><p>Choose a topic to start. Your conversation will appear here.</p></div>
      )}
      {!!history?.sessions.length && (
        <ul className="session-history-list">
          {history.sessions.map((session) => (
            <li key={session.id}>
              <Link href={`/session/${session.id}`} className="session-history-link" aria-current={pathname === `/session/${session.id}` ? "page" : undefined} onClick={onNavigate}>
                <div>
                  <h3>{session.topicTitle}</h3>
                  <p><time dateTime={session.lastActivityAt}>{formatDate(session.lastActivityAt)}</time></p>
                  <p>{session.messageCount} messages</p>
                </div>
                <span className="session-history-result">{session.latestAttempt ? `Exam: ${session.latestAttempt.score}/${session.latestAttempt.total}` : "Not examined yet"}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {history?.nextOffset != null && !error && (
        <button className="secondary session-history-more" onClick={() => void load(history.nextOffset ?? 0)} disabled={loading}>
          {loading ? "Loading…" : "Show more"}
        </button>
      )}
    </section>
  );
}
