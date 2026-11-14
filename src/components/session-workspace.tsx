"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import type { SendMessageResponse, SessionResponse } from "@/lib/types";

export function SessionWorkspace({ sessionId }: { sessionId: string }) {
  const [data, setData] = useState<SessionResponse | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [retry, setRetry] = useState(0);
  const [saved, setSaved] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    setError("");
    setData(null);
    api<SessionResponse>(`/api/sessions/${encodeURIComponent(sessionId)}`)
      .then((result) => { if (active) setData(result); })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "This session could not be loaded."); });
    return () => { active = false; };
  }, [sessionId, retry]);

  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [data?.messages.length]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!text.trim() || saving || !data) return;
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const { message } = await api<SendMessageResponse>(`/api/sessions/${sessionId}/messages`, {
        method: "POST", body: JSON.stringify({ text: text.trim() }),
      });
      setData((current) => current ? { ...current, messages: [...current.messages, message] } : current);
      setText("");
      setSaved(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Your explanation could not be saved. Please try again."); }
    finally { setSaving(false); }
  }

  return (
    <div className="session-workspace">
      <Link className="back-link" href="/">Back to topics</Link>
      <h1>Your teaching session</h1>
      <p className="session-intro">Put the idea into your own words. Start with what you know.</p>
      {error && <div className="notice error" role="alert"><p>{error}</p>{!data && <button className="secondary" onClick={() => setRetry((value) => value + 1)}>Try again</button>}</div>}
      {!data && !error && <p role="status">Opening your session…</p>}
      {data && <div className="session-grid">
        <section aria-labelledby="explanation-title">
          <h2 id="explanation-title">Your explanation</h2>
          <p className="notice">Student replies are coming soon. You can save your explanation now.</p>
          <div className="transcript" role="log" aria-label="Session messages" aria-live="polite">
            {data.messages.length === 0 && <div className="empty-state"><h3>Start with the big idea.</h3><p>What would you tell someone meeting this topic for the first time?</p></div>}
            {data.messages.map((message) => <article className={`message message-${message.role}`} key={message.id}><strong>{message.role === "user" ? "You" : "Student"}</strong><p>{message.text}</p></article>)}
            <div ref={end} />
          </div>
          <form onSubmit={(event) => void send(event)}>
            <label htmlFor="explanation">Explain the topic</label>
            <textarea id="explanation" value={text} onChange={(event) => { setText(event.target.value); setSaved(false); }} maxLength={10000} rows={5} placeholder="The way I understand it…" disabled={saving} aria-describedby="save-status" />
            <div className="composer-actions"><span id="save-status" role="status">{saving ? "Saving…" : saved ? "Explanation saved." : "Saved to this session when you submit."}</span><button type="submit" disabled={saving || !text.trim()}>{saving ? "Saving…" : "Save explanation"}</button></div>
          </form>
        </section>
        <aside aria-labelledby="notebook-title"><h2 id="notebook-title">Student’s notebook</h2>
          {data.notebook.length ? <ul className="notebook">{data.notebook.map((entry) => <li key={entry.id}>{entry.claim}</li>)}</ul> : <p>The notebook will be available when your student is connected.</p>}
          <hr /><h3>Student exam</h3><p>Your student will answer using only their notebook.</p><button disabled>Exam coming soon</button><p className="muted">Results and a breakdown will appear after an attempt.</p>
        </aside>
      </div>}
    </div>
  );
}
