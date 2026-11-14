import type { SavedExamAttempt } from "@/lib/types";
import { AttemptComparison } from "@/components/attempt-comparison";

interface ExamReviewProps {
  attempt: SavedExamAttempt;
  previousAttempt: SavedExamAttempt | null;
  stale: boolean;
  disabled: boolean;
  debriefError: string;
  onDebrief: () => void;
}

export function ExamReview({ attempt, previousAttempt, stale, disabled, debriefError, onDebrief }: ExamReviewProps) {
  const notes = new Map(attempt.notebookSnapshot.map((entry) => [entry.id, entry]));
  return <section className="exam-review" id="exam-review" tabIndex={-1} aria-labelledby="exam-review-title">
    <h2 id="exam-review-title">Your student scored {attempt.score}/{attempt.total}</h2>
    <p className="muted">{stale ? "This result uses an earlier notebook. Update the notebook and retake the exam to test your latest explanation." : attempt.score === attempt.total ? "Your student answered every question correctly and cited your notebook." : "Use the questions below to see what needs a clearer explanation."}</p>
    <AttemptComparison previous={previousAttempt} current={attempt} />
    <ol className="exam-review-list">
      {attempt.results.map((result, index) => {
        const selected = result.options.find((option) => option.id === result.answer)?.text;
        const expected = result.options.find((option) => option.id === result.correctAnswer)?.text;
        const gap = attempt.gaps?.find((item) => item.questionId === result.questionId);
        return <li key={result.questionId}>
          <details open={!result.correct}>
            <summary><span className={`answer-status ${result.correct ? "answer-correct" : "answer-needs-work"}`}>{result.correct ? "Correct" : result.guessed ? "No supported answer" : "Needs another explanation"}</span><span>{index + 1}. {result.questionText}</span></summary>
            <div className="answer-detail">
              <dl>
                <dt>Student’s answer</dt><dd>{selected ?? "The notebook did not support an answer."}</dd>
                <dt>Expected answer</dt><dd>{expected}</dd>
                <dt>Student’s reasoning</dt><dd>{result.reasoning}</dd>
              </dl>
              {result.notebookRefs.length > 0 && <div className="answer-evidence"><h3>Notes used in this attempt</h3><ul>{result.notebookRefs.map((id) => <li key={id}>{notes.get(id)?.claim ?? "This note is unavailable in the saved snapshot."}</li>)}</ul></div>}
              {gap && <div className="answer-gap"><h3>Explain next</h3><p>{gap.missingIdea}</p></div>}
            </div>
          </details>
        </li>;
      })}
    </ol>
    {attempt.gaps === null && <div className="notice">
      <p>{debriefError || "The result is saved. Load the breakdown to see which ideas to revisit."}</p>
      <button type="button" className="secondary" disabled={disabled} onClick={onDebrief}>Load breakdown</button>
    </div>}
    <div className="review-next"><a href="#explanation">{attempt.score === attempt.total ? "Keep explaining" : "Explain the missing ideas"}</a><p className="muted">Practice results do not predict your real exam score.</p></div>
  </section>;
}
