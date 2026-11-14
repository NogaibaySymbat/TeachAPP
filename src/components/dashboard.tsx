"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { CreateSessionResponse, Progress, TopicSummary } from "@/lib/types";
import { SessionHistory } from "@/components/session-history";

const statusLabels = { not_started: "Not started", failed: "Ready to revisit", passed: "Student passed" };

export function Dashboard({ examTitles }: { examTitles: string[] }) {
  const router = useRouter();
  const [topics, setTopics] = useState<TopicSummary[] | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState("");
  const [progressError, setProgressError] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const loadSequence = useRef(0);

  const load = useCallback(async () => {
    const sequence = ++loadSequence.current;
    setLoading(true);
    setError("");
    setProgressError(false);
    const [topicResult, progressResult] = await Promise.allSettled([
      api<TopicSummary[]>("/api/topics"), api<Progress>("/api/progress"),
    ]);
    if (sequence !== loadSequence.current) return;
    if (topicResult.status === "fulfilled") setTopics(topicResult.value);
    else setError(topicResult.reason instanceof Error ? topicResult.reason.message : "Topics could not be loaded.");
    if (progressResult.status === "fulfilled") setProgress(progressResult.value);
    else { setProgress(null); setProgressError(true); }
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) void load(); });
    const refresh = () => { void load(); };
    window.addEventListener("study-history-updated", refresh);
    return () => {
      active = false;
      loadSequence.current += 1;
      window.removeEventListener("study-history-updated", refresh);
    };
  }, [load]);

  async function start(topicId: string) {
    setStarting(topicId);
    setError("");
    try {
      const response = await api<CreateSessionResponse>("/api/sessions", {
        method: "POST", body: JSON.stringify({ topicId }),
      });
      router.push(`/session/${response.sessionId}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The session could not be started.");
      setStarting(null);
    }
  }

  return (
    <div className="dashboard">
      <section className="intro">
        <h1>Understanding starts<br />with explaining.</h1>
        <p>Explain a topic in your own words. See what your student writes down, then let them take the practice exam.</p>
        <div className="study-meta"><span>{examTitles.join(" · ") || "Study topics"}</span><span>Your sessions, ready to continue</span></div>
      </section>
      <div className="workspace-grid">
        <div className="study-sections">
          <section aria-labelledby="topics-title" aria-busy={loading}>
            <div className="section-heading"><h2 id="topics-title">Your topics</h2><span>{topics ? `${topics.length} available` : "Loading"}</span></div>
            {error && <div className="notice error" role="alert"><p>{error}</p><button className="secondary" onClick={() => void load()} disabled={loading}>Try again</button></div>}
            {loading ? <p className="empty-state" role="status">Loading your study space…</p> : topics?.length === 0 ? (
              <div className="empty-state"><h3>Your first topic is on its way.</h3><p>This workspace is being prepared. Study topics will appear here when they are ready.</p><button className="secondary" onClick={() => void load()}>Check for topics</button></div>
            ) : (
              <ul className="topic-list">{topics?.map((topic) => (
                <li key={topic.id}>
                  <div><span className={`status status-${topic.status}`}>{statusLabels[topic.status]}</span><h3>{topic.title}</h3><p>{topic.description}</p>{topic.bestScore !== null && <p>Best score: {topic.bestScore}</p>}</div>
                  <button disabled={starting !== null} onClick={() => void start(topic.id)}>{starting === topic.id ? "Starting…" : topic.status === "not_started" ? "Start explaining" : "Explain again"}</button>
                </li>
              ))}</ul>
            )}
          </section>
          <SessionHistory />
        </div>
        <aside aria-labelledby="progress-title">
          <h2 id="progress-title">Keep the thread</h2>
          <p>A little explaining each day goes a long way.</p>
          {loading ? <p role="status">Loading progress…</p> : progressError ? <div><p className="muted">Your progress is unavailable right now.</p><button className="secondary" onClick={() => void load()}>Retry progress</button></div> : progress && <p className="streak">{progress.streak} {progress.streak === 1 ? "day" : "days"} in a row</p>}
          {progress?.topicOfTheDay && <p>{progress.topicOfTheDay.reason}</p>}
          <hr />
          <h3>How it works</h3>
          <ol className="steps"><li>Choose a topic and explain it in your own words.</li><li>Review the notes your student took.</li><li>Let your student take the exam, then explain the gaps.</li></ol>
        </aside>
      </div>
    </div>
  );
}
