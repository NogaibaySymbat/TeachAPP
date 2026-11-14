import { compareAttempts } from "@/lib/attempt-comparison";
import type { SavedExamAttempt } from "@/lib/types";

export function AttemptComparison({ previous, current }: { previous: SavedExamAttempt | null; current: SavedExamAttempt }) {
  if (!previous || previous.id === current.id) return <p className="notice">Your first result is saved. Add an explanation and retake the exam to compare your attempts here.</p>;
  const comparison = compareAttempts(previous, current);
  return <section className="attempt-comparison" aria-labelledby="attempt-comparison-title">
    <h3 id="attempt-comparison-title">Before and after your explanation</h3>
    <dl className="comparison-scores">
      <div><dt>Previous attempt</dt><dd>{previous.score}/{previous.total}</dd></div>
      <div><dt>Latest attempt</dt><dd>{current.score}/{current.total}</dd></div>
      <div><dt>Change</dt><dd>{comparison.delta === null ? "Not comparable" : comparison.delta > 0 ? `+${comparison.delta} correct` : comparison.delta < 0 ? `${comparison.delta} correct` : "Same score"}</dd></div>
    </dl>
    {!comparison.comparable ? <p className="muted">The questions or answer choices changed between attempts. These scores are not a direct measure of improvement.</p> : <>
      <p>{comparison.improved.length} newly correct · {comparison.regressed.length} no longer correct</p>
      {comparison.improved.length > 0 && <div className="comparison-changes"><h4>Now answered correctly</h4><ul>{comparison.improved.map((result) => <li key={result.questionId}>{result.questionText}</li>)}</ul></div>}
      {comparison.regressed.length > 0 && <div className="comparison-changes"><h4>Needs another look</h4><ul>{comparison.regressed.map((result) => <li key={result.questionId}>{result.questionText}</li>)}</ul></div>}
      {comparison.newlyCitedNotes.length > 0 && <div className="comparison-changes"><h4>New notes cited in improved answers</h4><ul>{comparison.newlyCitedNotes.map((note) => <li key={note.id}><p>{note.claim}</p><a href={`#message-${note.sourceMessageId}`}>Your source explanation</a></li>)}</ul><p className="muted">These are the student’s cited notes, not proof of what caused the score change.</p></div>}
    </>}
    <p className="muted">{comparison.addedNotes.length} new or revised {comparison.addedNotes.length === 1 ? "note" : "notes"} since the previous attempt. Comparing saved attempts in this session.</p>
  </section>;
}
