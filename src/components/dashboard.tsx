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
          <p>PMP is the project management certification exam. Explain a topic in your own words. Your student writes down only what you said, then takes a practice exam from those notes. Every wrong answer points to an idea to explain again.</p>
          <div className="study-meta"><span>{examTitles.join(" · ") || "Study topics"}</span><span>Works alongside your course and question bank</span></div>
        </section>
        <section className="session-example" aria-labelledby="example-title">
          <div className="section-heading"><h2 id="example-title">How it works</h2><span>Example</span></div>
          <ol>
            <li><span className="example-step">You explain</span><p>&ldquo;A risk is something that might go wrong, so we deal with it when it happens.&rdquo;</p></li>
            <li><span className="example-step">Your student takes notes</span><p>Only your words, quoted: <q>deal with it when it happens</q></p></li>
            <li><span className="example-step">Your student takes the exam</span><p>&ldquo;A vendor may deliver late. What should the project manager do first?&rdquo; It answers from your notes and gets it wrong.</p></li>
            <li><span className="example-step">You find the gap</span><p>Explain how to respond to a risk before it occurs, then let your student retake the exam.</p></li>
          </ol>
        </section>
      </div>
      <section className="study-sections" aria-labelledby="topics-title" aria-busy={loading}>
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
