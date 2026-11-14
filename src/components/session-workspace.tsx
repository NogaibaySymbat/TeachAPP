"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { VoiceInput } from "@/components/voice-input";
import { LearningPanel } from "@/components/learning-panel";
import { ExamReview } from "@/components/exam-review";
import { api } from "@/lib/api";
import type { DebriefResponse, ExamResponse, Message, NotebookResponse, SendMessageResponse, SessionResponse } from "@/lib/types";

export function SessionWorkspace({ sessionId }: { sessionId: string }) {
  return <Conversation key={sessionId} sessionId={sessionId} />;
}

function Conversation({ sessionId }: { sessionId: string }) {
  const [data, setData] = useState<SessionResponse | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [replyError, setReplyError] = useState("");
  const [phase, setPhase] = useState<"idle" | "saving" | "working" | "exam" | "debrief">("idle");
  const [replying, setReplying] = useState(false);
  const [updatingNotebook, setUpdatingNotebook] = useState(false);
  const [learningError, setLearningError] = useState("");
  const [debriefError, setDebriefError] = useState("");
  const [retry, setRetry] = useState(0);
  const [saved, setSaved] = useState(false);
  const [voiceActive, setVoiceActive] = useState(false);
  const busy = useRef(false);
  const end = useRef<HTMLDivElement>(null);
  const explanation = useRef<HTMLTextAreaElement>(null);
  const path = `/api/sessions/${encodeURIComponent(sessionId)}`;
  const canReply = Boolean(data?.ai.available);
  const lastExplanation = data?.messages.findLast((message) => message.role === "user");
  const unanswered = lastExplanation && !data?.messages.some((message) => message.replyToMessageId === lastExplanation.id)
    ? lastExplanation : null;
  const activity = phase === "saving" ? "Saving your explanation…" : phase === "exam" ? "Your student is taking the exam…" : phase === "debrief" ? "Loading the breakdown…" : replying && updatingNotebook ? "Your student is replying and taking notes…" : replying ? "Waiting for your student…" : updatingNotebook ? "Updating the notebook…" : "Refreshing your session…";

  useEffect(() => {
    let active = true;
    api<SessionResponse>(path)
      .then((result) => { if (active) setData(result); })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "This session could not be loaded."); });
    return () => { active = false; };
  }, [path, retry]);

  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [data?.messages.length, phase]);

  function appendMessage(message: Message) {
    setData((current) => current && !current.messages.some((item) => item.id === message.id)
      ? { ...current, messages: [...current.messages, message] } : current);
  }

  async function requestReply(messageId: string) {
    setReplying(true);
    setReplyError("");
    try {
      const result = await api<{ message: Message }>(`${path}/reply`, {
        method: "POST", body: JSON.stringify({ messageId }),
      });
      appendMessage(result.message);
    } catch (cause) {
      setReplyError(cause instanceof Error ? cause.message : "The student could not reply. Try again in a moment.");
    } finally { setReplying(false); }
  }

  async function refreshSession() {
    try { setData(await api<SessionResponse>(path)); }
    catch { setError("Your work is saved, but the latest session could not be loaded. Reload the page to refresh it."); }
  }

  async function requestNotebook() {
    setUpdatingNotebook(true);
    setLearningError("");
    try {
      const result = await api<NotebookResponse>(`${path}/notebook`, { method: "POST", body: "{}" });
      setData((current) => current ? { ...current, notebook: result.notebook, learning: result.learning } : current);
    } catch (cause) {
      setLearningError(cause instanceof Error ? cause.message : "The notebook could not be updated. Your explanation is saved.");
    } finally { setUpdatingNotebook(false); }
  }

  async function updateNotebook() {
    if (busy.current || voiceActive || !data || (!data.ai.available && data.messages.some((message) => message.role === "user"))) return;
    busy.current = true;
    setPhase("working");
    try { await requestNotebook(); await refreshSession(); }
    finally { busy.current = false; setPhase("idle"); }
  }

  async function runExam() {
    if (busy.current || voiceActive || !data?.learning.notebookFresh || (!data.ai.available && data.notebook.length > 0)) return;
    busy.current = true;
    setPhase("exam");
    setLearningError("");
    setDebriefError("");
    try {
      const result = await api<ExamResponse>(`${path}/exam`, { method: "POST", body: "{}" });
      setData((current) => current ? { ...current, latestAttempt: result.attempt } : current);
      await refreshSession();
      window.dispatchEvent(new Event("study-history-updated"));
      requestAnimationFrame(() => { document.getElementById("exam-review")?.scrollIntoView({ block: "start" }); });
    } catch (cause) {
      setLearningError(cause instanceof Error ? cause.message : "The exam could not finish. Your notebook and previous result are saved.");
    } finally { busy.current = false; setPhase("idle"); }
  }

  async function loadDebrief() {
    if (busy.current || voiceActive || !data?.latestAttempt) return;
    busy.current = true;
    setPhase("debrief");
    setDebriefError("");
    try {
      const result = await api<DebriefResponse>(`${path}/debrief`, { method: "POST", body: JSON.stringify({ attemptId: data.latestAttempt.id }) });
      setData((current) => current?.latestAttempt?.id === result.attemptId ? { ...current, latestAttempt: { ...current.latestAttempt, gaps: result.gaps } } : current);
    } catch (cause) { setDebriefError(cause instanceof Error ? cause.message : "The breakdown could not be loaded. Please try again."); }
    finally { busy.current = false; setPhase("idle"); }
  }

  async function retryReply(messageId: string) {
    if (busy.current || voiceActive || !canReply) return;
    busy.current = true;
    setPhase("working");
    try { await requestReply(messageId); await refreshSession(); }
    finally { busy.current = false; setPhase("idle"); }
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!text.trim() || busy.current || voiceActive || !data) return;
    busy.current = true;
    setPhase("saving");
    setSaved(false);
    setError("");
    setReplyError("");
    try {
      const { message } = await api<SendMessageResponse>(`${path}/messages`, {
        method: "POST", body: JSON.stringify({ text: text.trim() }),
      });
      appendMessage(message);
      setData((current) => current ? { ...current, learning: { ...current.learning, notebookFresh: false } } : current);
      setText("");
      setSaved(true);
      if (canReply) {
        setPhase("working");
        await Promise.all([requestReply(message.id), requestNotebook()]);
      }
      await refreshSession();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your explanation could not be saved. Please try again.");
    } finally { busy.current = false; setPhase("idle"); }
  }

  return (
    <div className="session-workspace">
      <Link className="back-link" href="/">Back to topics</Link>
      <h1>Your teaching session</h1>
      <p className="session-intro">Put the idea into your own words. Your student will ask about what needs explaining.</p>
      {error && <div className="notice error" role="alert"><p>{error}</p>{!data && <button className="secondary" onClick={() => { setError(""); setRetry((value) => value + 1); }}>Try again</button>}</div>}
      {!data && !error && <p role="status">Opening your session…</p>}
      {data && <div className="session-grid">
        <section aria-labelledby="explanation-title">
          <h2 id="explanation-title">Teach your student</h2>
          {!data.ai.available ? <p className="notice">{data.ai.message} Your explanations can still be saved.</p> : (
            <p className="session-guidance">Explain one idea at a time, then answer your student’s questions.</p>
          )}
          <div className="transcript" role="log" aria-label="Session messages" aria-live="polite">
            {data.messages.length === 0 && <div className="empty-state"><h3>Start with the big idea.</h3><p>What would you tell someone meeting this topic for the first time?</p></div>}
            {data.messages.map((message) => <article className={`message message-${message.role}`} key={message.id} id={`message-${message.id}`}><strong>{message.role === "user" ? "You" : "AI student"}</strong><p>{message.text}</p></article>)}
            {replying && <p className="student-thinking" role="status">Your student is reading your explanation…</p>}
            <div ref={end} />
          </div>
          {unanswered && canReply && phase === "idle" && <div className={`notice reply-recovery${replyError ? " error" : ""}`} role={replyError ? "alert" : "status"}>
            <p>{replyError || "Your explanation is saved. You can ask your student to respond."}</p>
            {replyError && <p>Your explanation is saved; you do not need to send it again.</p>}
            <button className="secondary" disabled={voiceActive} onClick={() => void retryReply(unanswered.id)}>{replyError ? "Try student reply again" : "Get student reply"}</button>
          </div>}
          <form onSubmit={(event) => void send(event)}>
            <label htmlFor="explanation">Explain the topic</label>
            <textarea ref={explanation} id="explanation" value={text} onChange={(event) => { setText(event.target.value); setSaved(false); }} maxLength={4000} rows={5} placeholder="The way I understand it…" disabled={phase !== "idle" || voiceActive} aria-describedby="save-status" />
            <VoiceInput value={text} disabled={phase !== "idle"} onActiveChange={setVoiceActive} onAppend={(dictated) => {
              setText((current) => `${current}${current && !/\s$/u.test(current) ? " " : ""}${dictated}`);
              setSaved(false);
              explanation.current?.focus();
            }} />
            <div className="composer-actions"><span id="save-status" role="status">{phase !== "idle" ? activity : voiceActive ? "Stop dictation to review your words before sending." : saved ? "Explanation saved." : "Up to 4,000 characters. Write in any language."}</span><button type="submit" disabled={phase !== "idle" || voiceActive || !text.trim()}>{phase !== "idle" ? "Working…" : canReply ? "Send explanation" : "Save explanation"}</button></div>
          </form>
        </section>
        <LearningPanel data={data} disabled={phase !== "idle" || voiceActive} updating={updatingNotebook} examining={phase === "exam"} error={learningError} onUpdate={() => void updateNotebook()} onExam={() => void runExam()} />
      </div>}
      {data?.latestAttempt && <ExamReview attempt={data.latestAttempt} stale={!data.learning.notebookFresh || data.latestAttempt.revision !== data.learning.revision} disabled={phase !== "idle" || voiceActive} debriefError={debriefError} onDebrief={() => void loadDebrief()} />}
    </div>
  );
}
