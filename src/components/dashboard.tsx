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

  const streak = progress?.streak ?? 0;
  const todayReason = selectedTopic && selectedTopic.id === todayTopic?.id ? progress?.topicOfTheDay?.reason : undefined;

  return (
    <div className="dashboard">
      <div className="home-hero">
        <section className="intro">
          <h1>Teach PMP to an AI student.<br /><span>See what you can&apos;t explain yet.</span></h1>
          <p>Prepare for the project management certification exam by teaching Milo. Explain an idea, review his notes, then see what he can answer.</p>
          <div className="home-start"><a className="primary-link" href="#topics">Choose a topic<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg></a><span>Free preview</span></div>
          <div className="study-meta"><span>{examTitles.join(" · ") || "Study topics"}</span><span>Works alongside your course and question bank</span></div>
        </section>
        <section className="session-example" aria-labelledby="example-title">
          <div className="section-heading"><h2 id="example-title">How it works</h2><span>Example</span></div>
          <ol>
            <li><span className="example-step">Explain an idea</span><p>&ldquo;We deal with risks when they happen.&rdquo;</p></li>
            <li><span className="example-step">Check Milo’s notes</span><p><q>deal with risks when they happen</q> — your words, mistakes included.</p></li>
            <li><span className="example-step">See the gap</span><p>A practice question asks how to act before a risk occurs. That idea is missing.</p></li>
            <li><span className="example-step">Explain again & retake</span><p>Teach the missing idea, then compare the results.</p></li>
          </ol>
        </section>
      </div>
      <section className="study-sections" id="topics" tabIndex={-1} aria-labelledby="topics-title" aria-busy={loading}>
        <div className="section-heading">
          <h2 id="topics-title">Pick a topic to teach</h2>
          {loading ? <span role="status">Loading</span> : progressError ? <button className="secondary progress-retry" onClick={() => void load()}>Retry progress</button> : streak > 0 ? <span className="streak">Daily streak: {streak} {streak === 1 ? "day" : "days"} in a row</span> : <span>{topics ? `${topics.length} ${topics.length === 1 ? "topic" : "topics"}` : ""}</span>}
        </div>
        {error && <div className="notice error" role="alert"><p>{error}</p><button className="secondary" onClick={() => void load()} disabled={loading}>Try again</button></div>}
        {loading ? <p className="empty-state" role="status">Loading your study space…</p> : topics?.length === 0 ? (
          <div className="empty-state"><h3>Your first topic is on its way.</h3><p>This workspace is being prepared. Study topics will appear here when they are ready.</p><button className="secondary" onClick={() => void load()}>Check for topics</button></div>
        ) : (
          selectedTopic && <div className="topic-picker">
            <TopicChoice topics={topics ?? []} selected={selectedTopic} todayId={todayTopic?.id} disabled={starting !== null} onChange={setSelectedId} />
            <div className="selected-topic" aria-live="polite">
              <p>{selectedTopic.description}</p>
              {todayReason && <p className="today-reason">{todayReason}</p>}
            </div>
            <button disabled={starting !== null} onClick={() => void start(selectedTopic.id)}>{starting ? "Starting…" : `Start teaching: ${selectedTopic.title}`}<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg></button>
          </div>
        )}
      </section>
    </div>
  );
}
