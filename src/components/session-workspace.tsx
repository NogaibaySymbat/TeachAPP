"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { VoiceInput } from "@/components/voice-input";
import { SpeakMessageButton, VoiceOutputToggle, useStudentVoice } from "@/components/voice-output";
import { LearningPanel } from "@/components/learning-panel";
import { ExamReview } from "@/components/exam-review";
import { SessionExportControls } from "@/components/session-export";
import { StudentPersona } from "@/components/student-persona";
import { getStudentPersona } from "@/lib/student-persona";
import { api } from "@/lib/api";
import { compareNotebookUpdate, type NotebookUpdate } from "@/lib/notebook-view";
import type { DebriefResponse, ExamResponse, Message, NotebookEntry, NotebookResponse, SendMessageResponse, SessionResponse } from "@/lib/types";

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
  const [notebookUpdate, setNotebookUpdate] = useState<NotebookUpdate | null>(null);
  const [clarifying, setClarifying] = useState<NotebookEntry | null>(null);
  const [revisitingQuestion, setRevisitingQuestion] = useState<string | null>(null);
  const [reviewingAttemptId, setReviewingAttemptId] = useState<string | null>(null);
  const [learningError, setLearningError] = useState("");
  const [debriefError, setDebriefError] = useState("");
  const [retry, setRetry] = useState(0);
  const [saved, setSaved] = useState(false);
  const [voiceActive, setVoiceActive] = useState(false);
  const studentVoice = useStudentVoice(sessionId);
  const stopStudentVoice = studentVoice.stop;
  // Keep the student quiet while the microphone is on, so it does not hear itself.
  useEffect(() => { if (voiceActive) stopStudentVoice(); }, [voiceActive, stopStudentVoice]);
  const busy = useRef(false);
  const end = useRef<HTMLDivElement>(null);
  const explanation = useRef<HTMLTextAreaElement>(null);
  const path = `/api/sessions/${encodeURIComponent(sessionId)}`;
  const canReply = Boolean(data?.ai.available);
  const freshResult = Boolean(data?.latestAttempt && data.learning.notebookFresh && data.latestAttempt.revision === data.learning.revision);
  const reviewing = freshResult && reviewingAttemptId === data?.latestAttempt?.id;
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

  useEffect(() => {
    // Keep new messages in the transcript without moving the whole page on load.
    const transcript = end.current?.parentElement;
    if (transcript && !window.location.hash.startsWith("#message-")) transcript.scrollTop = transcript.scrollHeight;
  }, [data?.messages.length, replying]);

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
      studentVoice.announce(result.message.id, result.message.text);
    } catch (cause) {
      setReplyError(cause instanceof Error ? cause.message : "The student could not reply. Try again in a moment.");
    } finally { setReplying(false); }
  }

  async function refreshSession() {
    try { setData(await api<SessionResponse>(path)); }
    catch { setError("Your work is saved, but the latest session could not be loaded. Reload the page to refresh it."); }
  }

  async function requestNotebook() {
    const previousNotebook = data?.notebook ?? [];
    setUpdatingNotebook(true);
    setLearningError("");
    try {
      const result = await api<NotebookResponse>(`${path}/notebook`, { method: "POST", body: "{}" });
      setNotebookUpdate(compareNotebookUpdate(previousNotebook, result.notebook, result.learning.revision));
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
      // Only new results enter the walkthrough; cached/reloaded attempts stay fully visible.
      if (result.attempt.id !== data.latestAttempt?.id) setReviewingAttemptId(result.attempt.id);
      setData((current) => current ? { ...current, latestAttempt: result.attempt,
        previousAttempt: current.latestAttempt?.id === result.attempt.id ? current.previousAttempt : current.latestAttempt,
      } : current);
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
      setClarifying(null);
      setRevisitingQuestion(null);
      setReviewingAttemptId(null);
      setSaved(true);
      window.dispatchEvent(new Event("study-history-updated"));
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
      <Link className="back-link" href="/"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M19 12H5m6-6-6 6 6 6" /></svg>Back to topics</Link>
      <h1>{data?.topic?.title ?? "Your teaching session"}</h1>
      <p className="session-intro">Explain an idea. Check Milo’s notes. Try the exam.</p>
      {error && <div className="notice error" role="alert"><p>{error}</p>{!data && <button className="secondary" onClick={() => { setError(""); setRetry((value) => value + 1); }}>Try again</button>}</div>}
      {!data && !error && <p role="status">Opening your session…</p>}
      {data && <div className="session-grid">
        <section className="chat-panel" aria-labelledby="explanation-title">
          <StudentPersona state={getStudentPersona(data, { listening: voiceActive, examining: phase === "exam", writing: updatingNotebook, replying, reviewing })} />
          {!data.ai.available && <p className="notice">{data.ai.message} You can keep explaining; everything you write is saved.</p>}
          <div className="chat-tools"><div className="notebook-shortcut"><a href="#student-notebook">View notebook <span>{data.notebook.length}</span><span aria-hidden="true"> ↗</span></a></div><VoiceOutputToggle voice={studentVoice} /></div>
          <div className={`transcript${data.messages.length === 0 && !replying ? " is-empty" : ""}`} role="log" aria-label="Session messages" aria-live="polite">
            {data.messages.map((message) => <article className={`message message-${message.role}`} key={message.id} id={`message-${message.id}`}><div className="message-meta"><strong>{message.role === "user" ? "You" : "Milo · AI student"}</strong><time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></div><p>{message.text}</p>{message.role === "student" && <SpeakMessageButton voice={studentVoice} messageId={message.id} text={message.text} />}</article>)}
            {replying && <div className="student-thinking" role="status"><span className="thinking-dots" aria-hidden="true"><i /><i /><i /></span>Your student is reading and replying…</div>}
            <div ref={end} />
          </div>
          {unanswered && canReply && phase === "idle" && <div className={`notice reply-recovery${replyError ? " error" : ""}`} role={replyError ? "alert" : "status"}>
            <p>{replyError || "Your explanation is saved. You can ask your student to respond."}</p>
            {replyError && <p>Your explanation is saved; you do not need to send it again.</p>}
            <button className="secondary" disabled={voiceActive} onClick={() => void retryReply(unanswered.id)}>{replyError ? "Try student reply again" : "Get student reply"}</button>
          </div>}
          <form className="chat-composer" onSubmit={(event) => void send(event)}>
            {clarifying && <div className="clarifying-note" id="clarifying-note"><div><strong>Clarify this idea</strong><button type="button" className="clarify-dismiss" aria-label="Stop clarifying this note" onClick={() => { setClarifying(null); explanation.current?.focus(); }}>×</button></div><blockquote>{clarifying.claim}</blockquote><p>Explain it again in your own words, or add an example below.</p></div>}
            {revisitingQuestion && <div className="clarifying-note" id="revisiting-question"><div><strong>Help Milo with this question</strong><button type="button" className="clarify-dismiss" aria-label="Stop revisiting this question" onClick={() => { setRevisitingQuestion(null); explanation.current?.focus(); }}>×</button></div><blockquote>{revisitingQuestion}</blockquote><p>Teach the idea behind it in your own words. Your draft is still here.</p></div>}
            <label htmlFor="explanation">{data.messages.length ? "Message Milo" : "Teach Milo one idea"}</label>
            <textarea ref={explanation} id="explanation" value={text} onChange={(event) => { setText(event.target.value); setSaved(false); }} maxLength={4000} rows={3} placeholder={data.messages.length ? "Explain an idea or answer Milo’s question…" : "The way I understand it…"} disabled={phase !== "idle" || voiceActive} aria-describedby={clarifying ? "clarifying-note save-status" : revisitingQuestion ? "revisiting-question save-status" : "save-status"} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} />
            <VoiceInput value={text} disabled={phase !== "idle"} onActiveChange={setVoiceActive} onAppend={(dictated) => {
              setText((current) => `${current}${current && !/\s$/u.test(current) ? " " : ""}${dictated}`);
              setSaved(false);
              explanation.current?.focus();
            }} />
            <div className="composer-actions"><span id="save-status" role="status">{phase !== "idle" ? activity : voiceActive ? "Stop dictation to review your words before sending." : saved ? "Explanation saved." : "Enter to send · Shift + Enter for a new line. Up to 4,000 characters."}</span><button type="submit" disabled={phase !== "idle" || voiceActive || !text.trim()}>{phase !== "idle" ? "Working…" : canReply ? "Send message" : "Save message"}</button></div>
          </form>
        </section>
        <LearningPanel data={data} disabled={phase !== "idle" || voiceActive} updating={updatingNotebook} replying={replying} replyError={replyError} update={notebookUpdate} examining={phase === "exam"} reviewing={reviewing} error={learningError} onUpdate={() => void updateNotebook()} onExam={() => void runExam()} onClarify={(entry) => {
          setClarifying(entry);
          setRevisitingQuestion(null);
          setSaved(false);
          // Keep any draft intact. Nothing is sent until the user submits the form.
          // Focus synchronously within the tap so mobile browsers can open the keyboard.
          explanation.current?.focus();
          requestAnimationFrame(() => { explanation.current?.scrollIntoView({ block: "center" }); });
        }} />
      </div>}
      {data?.latestAttempt && <ExamReview key={data.latestAttempt.id} attempt={data.latestAttempt} previousAttempt={data.previousAttempt ?? null} stale={!freshResult} disabled={phase !== "idle" || voiceActive} debriefError={debriefError} onDebrief={() => void loadDebrief()} walkthrough={reviewing} onWalkthroughChange={(active) => setReviewingAttemptId(active ? data.latestAttempt!.id : null)} onExplain={(question) => {
        setClarifying(null);
        setRevisitingQuestion(question);
        setReviewingAttemptId(null);
        setSaved(false);
        // Preserve the draft and focus in the click handler for mobile keyboards.
        explanation.current?.focus();
        requestAnimationFrame(() => { explanation.current?.scrollIntoView({ block: "center" }); });
      }} />}
      {data && <SessionExportControls sessionId={sessionId} disabled={phase !== "idle" || voiceActive} />}
    </div>
  );
}
