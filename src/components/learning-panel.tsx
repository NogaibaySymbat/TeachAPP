"use client";

import type { CSSProperties } from "react";
import { currentNotebookUpdate, latestStudentExchange, notebookEntryKey, type NotebookUpdate } from "@/lib/notebook-view";
import type { NotebookEntry, SessionResponse } from "@/lib/types";

interface LearningPanelProps {
  data: SessionResponse;
  disabled: boolean;
  updating: boolean;
  replying: boolean;
  replyError: string;
  update: NotebookUpdate | null;
  examining: boolean;
  reviewing?: boolean;
  error: string;
  onUpdate: () => void;
  onExam: () => void;
  onClarify: (entry: NotebookEntry) => void;
}

export function LearningPanel({ data, disabled, updating, replying, replyError, update, examining, reviewing = false, error, onUpdate, onExam, onClarify }: LearningPanelProps) {
  const { notebook, learning, latestAttempt } = data;
  const currentResult = learning.notebookFresh && latestAttempt?.revision === learning.revision;
  const explanations = data.messages.filter((message) => message.role === "user");
  const exchange = latestStudentExchange(data.messages);
  const changes = currentNotebookUpdate(update, learning);
  const added = new Set(changes?.addedKeys);
  const orderedNotes = [...notebook].sort((a, b) => explanations.findIndex((message) => message.id === a.sourceMessageId) - explanations.findIndex((message) => message.id === b.sourceMessageId));
  const status = updating ? "Taking notes…" : learning.notebookFresh ? "Up to date" : explanations.length ? "Update needed" : "Ready to learn";

  return <aside className="learning-panel" id="student-notebook" tabIndex={-1} aria-labelledby="notebook-title">
    <div className="notebook-heading"><svg width="22" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="5" y="3" width="15" height="18" rx="3" /><path d="M9 3v18M3 7h4M3 12h4M3 17h4m9-9h4m-4 4h4" /></svg><h2 id="notebook-title">Student’s notebook</h2></div>
    <p className="notebook-intro">{data.ai.available ? "Updates automatically after each message." : "Saved notes stay here while Milo is unavailable."}</p>
    <div className="notebook-sync" role="status"><span className={`notebook-status${updating ? " is-updating" : ""}`}>{status}</span><span>{notebook.length} {notebook.length === 1 ? "note" : "notes"}</span></div>

    {exchange && <section className="student-take" aria-labelledby="student-take-title">
      <h3 id="student-take-title">How I see it</h3>
      <p className="notebook-caption">Your student’s restatement & question</p>
      {exchange.reply ? <>
        <p className="student-take-text">{exchange.reply.text}</p>
        <a href={`#message-${exchange.reply.id}`}>See reply in chat</a>
      </> : <p className="student-take-waiting">{replying ? "Reading your latest explanation…" : replyError ? "The reply could not be loaded. Your saved notes are still below." : "No reply to your latest explanation yet."}</p>}
    </section>}

    <section className="notebook-evidence" aria-labelledby="written-down-title" aria-busy={updating}>
      <h3 id="written-down-title">What I wrote down</h3>
      <p className="notebook-caption">Exact words from your explanations</p>
      <p className="notebook-update-summary" role="status">{updating ? "Checking your explanations for notes…" : changes ? `${changes.addedKeys.length ? `${changes.addedKeys.length} new ${changes.addedKeys.length === 1 ? "note" : "notes"}.` : "No new notes in this update."}${changes.removedCount ? ` ${changes.removedCount} ${changes.removedCount === 1 ? "earlier note was" : "earlier notes were"} replaced or left out.` : ""}` : !learning.notebookFresh && explanations.length ? "These notes do not include your latest changes yet." : ""}</p>
      {notebook.length > 0 ? <ol className="notebook">
        {orderedNotes.map((entry, index) => {
          const sourceNumber = explanations.findIndex((message) => message.id === entry.sourceMessageId) + 1;
          const isNew = added.has(notebookEntryKey(entry));
          const source = explanations[sourceNumber - 1];
          const arrivalIndex = Math.max(0, changes?.addedKeys.indexOf(notebookEntryKey(entry)) ?? 0);
          // Stable evidence keys keep regenerated IDs from replaying unchanged notes.
          return <li className={isNew ? "notebook-entry is-new" : "notebook-entry"} key={notebookEntryKey(entry)} id={`note-${entry.id}`} style={{ "--note-delay": `${Math.min(arrivalIndex, 4) * 40}ms` } as CSSProperties}>
            <div className="note-heading"><span>Note {index + 1}</span>{isNew && <span className="note-new">New</span>}</div>
            <blockquote>{entry.claim}</blockquote>
            <div className="note-actions">
              {source && <details className="note-source"><summary>From your explanation<span className="sr-only">: original words for note {index + 1}</span></summary><p>{source.text}</p><a href={`#message-${entry.sourceMessageId}`}>Show explanation {sourceNumber} in chat</a></details>}
              <button type="button" className="note-clarify" disabled={disabled} onClick={() => onClarify(entry)}>Clarify<span className="sr-only"> note {index + 1}</span><span aria-hidden="true"> ↗</span></button>
            </div>
          </li>;
        })}
      </ol> : <div className="notebook-empty"><p>{updating ? "Your first notes will appear here." : learning.notebookFresh ? "No relevant statements were recorded. Try explaining one idea with an example." : "A blank page, for now. Teach one idea and watch your student take notes."}</p></div>}
    </section>
    {error && <div className="notice error" role="alert"><p>{error}</p></div>}
    {!learning.notebookFresh && explanations.length > 0 && !updating && <button type="button" className="secondary" disabled={disabled || !data.ai.available} onClick={onUpdate}>{error ? "Retry notebook update" : "Update notebook"}</button>}
    <p className="notebook-footnote">Notes preserve your words, including mistakes. The exam tests how the student uses them.</p>
    <hr />
    <h3 id="student-exam" tabIndex={-1}>Student exam</h3>
    <p>{learning.questionCount} practice questions. Your student can use only this notebook.</p>
    {currentResult && latestAttempt ? <>
      <p className="saved-score">{reviewing ? "Your exam results are ready." : `Latest result: ${latestAttempt.score}/${latestAttempt.total}`}</p>
      <a className="review-link" href="#exam-review">Review saved result</a>
    </> : <>
      <button type="button" disabled={disabled || (!data.ai.available && notebook.length > 0) || !learning.notebookFresh || learning.questionCount === 0} onClick={onExam}>
        {examining ? "Student is taking the exam…" : latestAttempt ? "Retake student exam" : "Start student exam"}
      </button>
      {!learning.notebookFresh && <p className="muted">{explanations.length === 0 ? "Send your first explanation to get started." : updating ? "The exam will be ready when these notes are saved." : "Update the notebook before the next attempt."}</p>}
      {latestAttempt && <p className="muted">Previous result: {latestAttempt.score}/{latestAttempt.total}. Your new explanation has not been tested yet.</p>}
    </>}
  </aside>;
}
