"use client";

import type { SessionResponse } from "@/lib/types";

interface LearningPanelProps {
  data: SessionResponse;
  disabled: boolean;
  updating: boolean;
  examining: boolean;
  error: string;
  onUpdate: () => void;
  onExam: () => void;
}

export function LearningPanel({ data, disabled, updating, examining, error, onUpdate, onExam }: LearningPanelProps) {
  const { notebook, learning, latestAttempt } = data;
  const currentResult = learning.notebookFresh && latestAttempt?.revision === learning.revision;
  const explanations = data.messages.filter((message) => message.role === "user");

  return <aside className="learning-panel" aria-labelledby="notebook-title">
    <div className="section-heading"><h2 id="notebook-title">Student’s notebook</h2><span>{notebook.length} notes</span></div>
    <p>Only what you taught, with a link to your words.</p>
    <p className="learning-status" role="status">{updating ? "Your student is taking notes…" : learning.notebookFresh ? "Up to date with your explanations." : notebook.length ? "New explanations are waiting to be added." : "Explain an idea to give your student something to learn."}</p>
    {notebook.length > 0 ? <ol className="notebook">
      {notebook.map((entry) => <li key={entry.id} id={`note-${entry.id}`}>
        <p>{entry.claim}</p>
        <a href={`#message-${entry.sourceMessageId}`}>Your explanation {explanations.findIndex((message) => message.id === entry.sourceMessageId) + 1}</a>
      </li>)}
    </ol> : learning.notebookFresh && <p>No relevant statements were found. Explain the idea and give an example; the student will not fill in missing knowledge.</p>}
    {error && <div className="notice error" role="alert"><p>{error}</p></div>}
    <button type="button" className="secondary" disabled={disabled || (!data.ai.available && explanations.length > 0) || learning.notebookFresh} onClick={onUpdate}>
      {updating ? "Updating notebook…" : learning.notebookFresh ? "Notebook up to date" : notebook.length ? "Update notebook" : "Build notebook"}
    </button>
    <hr />
    <h3>Student exam</h3>
    <p>{learning.questionCount} practice questions. Your student can use only this notebook.</p>
    {currentResult && latestAttempt ? <>
      <p className="saved-score">Latest result: {latestAttempt.score}/{latestAttempt.total}</p>
      <a className="review-link" href="#exam-review">Review saved result</a>
    </> : <>
      <button type="button" disabled={disabled || (!data.ai.available && notebook.length > 0) || !learning.notebookFresh || learning.questionCount === 0} onClick={onExam}>
        {examining ? "Student is taking the exam…" : latestAttempt ? "Retake student exam" : "Start student exam"}
      </button>
      {!learning.notebookFresh && <p className="muted">Update the notebook before the next attempt.</p>}
      {latestAttempt && <p className="muted">Previous result: {latestAttempt.score}/{latestAttempt.total}. Your new explanation has not been tested yet.</p>}
    </>}
  </aside>;
}
