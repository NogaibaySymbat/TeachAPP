"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { TopicChoice } from "@/components/topic-choice";
import type { CreateSessionResponse, Progress, TopicSummary } from "@/lib/types";
export function Dashboard({ examTitles }: { examTitles: string[] }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState("");
  const startLock = useRef(false);
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

  const todayTopic = progress?.topicOfTheDay ? topics?.find((topic) => topic.id === progress.topicOfTheDay?.topicId) : undefined;
  // Until the user picks a topic, the picker opens on the topic of the day.
  const selectedTopic = topics?.find((topic) => topic.id === selectedId) ?? todayTopic ?? topics?.[0];

  async function start(topicId: string) {
    if (startLock.current) return;
    startLock.current = true;
    setStarting(topicId);
    setError("");
    try {
      const response = await api<CreateSessionResponse>("/api/sessions", {
        method: "POST", body: JSON.stringify({ topicId }),
      });
      window.dispatchEvent(new Event("study-history-updated"));
      router.push(`/session/${response.sessionId}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The session could not be started.");
      setStarting(null);
      startLock.current = false;
    }
  }

  return (
    <div className="dashboard">
      <section className="intro">
        <h1>What will you teach<br /><span>your student today?</span></h1>
        <p>Explain a topic in your own words. See what your student writes down, then let them take the practice exam.</p>
        <div className="study-meta"><span>{examTitles.join(" · ") || "Study topics"}</span><span>Past conversations are in the history panel</span></div>
      </section>
      <div className="workspace-grid">
        <div className="study-sections">
          <section aria-labelledby="topics-title" aria-busy={loading}>
            <div className="section-heading"><h2 id="topics-title">Your topics</h2><span>{topics ? `${topics.length} available` : "Loading"}</span></div>
            {error && <div className="notice error" role="alert"><p>{error}</p><button className="secondary" onClick={() => void load()} disabled={loading}>Try again</button></div>}
            {loading ? <p className="empty-state" role="status">Loading your study space…</p> : topics?.length === 0 ? (
              <div className="empty-state"><h3>Your first topic is on its way.</h3><p>This workspace is being prepared. Study topics will appear here when they are ready.</p><button className="secondary" onClick={() => void load()}>Check for topics</button></div>
            ) : (
              selectedTopic && <div className="topic-picker">
                <TopicChoice topics={topics ?? []} selected={selectedTopic} disabled={starting !== null} onChange={setSelectedId} />
                <div className="selected-topic" aria-live="polite">
                  <p>{selectedTopic.description}</p>
                </div>
                <button disabled={starting !== null} onClick={() => void start(selectedTopic.id)}>{starting ? "Starting…" : "Start a conversation"}<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg></button>
              </div>
            )}
          </section>

        </div>
        <aside className="progress-panel" aria-labelledby="progress-title">
          <h2 id="progress-title">Keep the thread</h2>
          <p>A little explaining each day goes a long way.</p>
          {loading ? <p role="status">Loading progress…</p> : progressError ? <div><p className="muted">Your progress is unavailable right now.</p><button className="secondary" onClick={() => void load()}>Retry progress</button></div> : progress && <p className="streak">{progress.streak} {progress.streak === 1 ? "day" : "days"} in a row</p>}
          {todayTopic && progress?.topicOfTheDay && <section className="topic-of-day" aria-labelledby="topic-of-day-title">
            <h3 id="topic-of-day-title">Today&apos;s topic</h3>
            <p className="topic-of-day-name">{todayTopic.title}</p>
            <p>{progress.topicOfTheDay.reason}</p>
            <button disabled={starting !== null} onClick={() => void start(todayTopic.id)}>{starting === todayTopic.id ? "Starting…" : "Start this topic"}<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg></button>
          </section>}
          <hr />
          <h3>How it works</h3>
          <ol className="steps"><li>Choose a topic and explain it in your own words.</li><li>Review the notes your student took.</li><li>Let your student take the exam, then explain the gaps.</li></ol>
        </aside>
      </div>
    </div>
  );
}
