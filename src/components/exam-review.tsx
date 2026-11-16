"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { SavedExamAttempt } from "@/lib/types";
import { AttemptComparison } from "@/components/attempt-comparison";
import { StudentAvatar } from "@/components/student-persona";

interface ExamReviewProps {
  attempt: SavedExamAttempt;
  previousAttempt: SavedExamAttempt | null;
  stale: boolean;
  disabled: boolean;
  debriefError: string;
  onDebrief: () => void;
  walkthrough?: boolean;
  onWalkthroughChange?: (active: boolean) => void;
  onExplain?: (question: string) => void;
}

export function ExamReview({ attempt, previousAttempt, stale, disabled, debriefError, onDebrief, walkthrough = false, onWalkthroughChange, onExplain }: ExamReviewProps) {
  const [questionIndex, setQuestionIndex] = useState(0);
  const celebrationPending = useRef(walkthrough);
  const [celebrate, setCelebrate] = useState(false);
  const title = useRef<HTMLHeadingElement>(null);
  const question = useRef<HTMLHeadingElement>(null);
  const walking = walkthrough && !stale && attempt.results.length > 0;
  const result = attempt.results[Math.min(questionIndex, attempt.results.length - 1)];
  const passed = attempt.total > 0 && attempt.score === attempt.total;
  const pendingFocus = useRef<"title" | "question" | null>(walkthrough ? "title" : null);
  useLayoutEffect(() => {
    if (!pendingFocus.current) return;
    const target = pendingFocus.current === "title" ? title.current : question.current;
    pendingFocus.current = null;
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: "start" });
  }, [walking, questionIndex]);

  function showAll() {
    pendingFocus.current = "title";
    setCelebrate(celebrationPending.current);
    celebrationPending.current = false;
    onWalkthroughChange?.(false);
  }

  return <section className="exam-review" id="exam-review" tabIndex={-1} aria-labelledby="exam-review-title">
    <div className="exam-heading"><StudentAvatar expression={walking ? "curious" : !stale && passed ? "celebrating" : "neutral"} activity={walking ? "review" : "idle"} /><div>
      <h2 ref={title} tabIndex={-1} id="exam-review-title">{walking ? "Let’s open Milo’s exam" : `Milo scored ${attempt.score}/${attempt.total}`}</h2>
      <p className="muted">{stale ? "This result uses an earlier notebook. Update the notebook and retake the exam to test your latest explanation." : walking ? "The exam is saved. Explore each answer at your own pace." : passed ? "Every practice question answered correctly. Open the answers to check the notes Milo cited." : "Each missed question is a place to teach one more idea."}</p>
    </div></div>
    {walking ? <>
      <div className="exam-walkthrough-controls"><span role="status">Question {questionIndex + 1} of {attempt.results.length}</span><button type="button" className="secondary" onClick={showAll}>Show all results</button></div>
      <ol className="exam-steps" aria-label="Review progress">{attempt.results.map((item, index) => <li key={item.questionId} aria-current={index === questionIndex ? "step" : undefined} data-seen={index < questionIndex}><span>{index + 1}</span><span className="sr-only">{index < questionIndex ? "Reviewed" : index === questionIndex ? "Current question" : "Not reviewed yet"}</span></li>)}</ol>
      <div className="exam-question" key={result.questionId}>
        <p className={`answer-status ${result.correct ? "answer-correct" : "answer-needs-work"}`}>{answerStatus(result)}</p>
        <h3 ref={question} tabIndex={-1}>{result.questionText}</h3>
        <AnswerDetail result={result} attempt={attempt} disabled={disabled} onExplain={onExplain} />
      </div>
      <div className="exam-walkthrough-next"><p className="muted">Reviewing your saved exam</p><button type="button" onClick={() => {
        if (questionIndex + 1 >= attempt.results.length) { showAll(); return; }
        pendingFocus.current = "question";
        setQuestionIndex((index) => index + 1);
      }}>{questionIndex + 1 < attempt.results.length ? "Next question" : "See the full result"}<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg></button></div>
    </> : <>
      <AttemptComparison previous={previousAttempt} current={attempt} celebrate={celebrate && !stale} />
      {onWalkthroughChange && !stale && attempt.results.length > 0 && <button type="button" className="secondary exam-replay" onClick={() => { pendingFocus.current = "title"; setQuestionIndex(0); setCelebrate(false); onWalkthroughChange(true); }}>Review one question at a time</button>}
      <ol className="exam-review-list">
      {attempt.results.map((result, index) => <li key={result.questionId}>
          <details open={!result.correct}>
            <summary><span className={`answer-status ${result.correct ? "answer-correct" : "answer-needs-work"}`}>{answerStatus(result)}</span><span>{index + 1}. {result.questionText}</span></summary>
            <AnswerDetail result={result} attempt={attempt} disabled={disabled} onExplain={onExplain} />
          </details>
        </li>)}
      </ol>
    </>}
    {!walking && attempt.gaps === null && <div className="notice">
      <p>{debriefError || "The result is saved. Load the breakdown to see which ideas to revisit."}</p>
      <button type="button" className="secondary" disabled={disabled} onClick={onDebrief}>Load breakdown</button>
    </div>}
    <div className="review-next">{!walking && <a href="#explanation">{passed ? "Keep explaining" : "Explain the missing ideas"}</a>}<p className="muted">Practice results do not predict your real exam score.</p></div>
  </section>;
}

type Result = SavedExamAttempt["results"][number];

function answerStatus(result: Result) {
  return result.correct ? "Correct · check the cited notes" : result.guessed ? result.answer === null ? "Skipped · no supported answer" : "Not counted · unsupported answer" : "Needs another explanation";
}

function AnswerDetail({ result, attempt, disabled, onExplain }: { result: Result; attempt: SavedExamAttempt; disabled: boolean; onExplain?: (question: string) => void }) {
  const selected = result.options.find((option) => option.id === result.answer)?.text;
  const expected = result.options.find((option) => option.id === result.correctAnswer)?.text;
  const gap = attempt.gaps?.find((item) => item.questionId === result.questionId);
  const notes = new Map(attempt.notebookSnapshot.map((entry) => [entry.id, entry]));
  return <div className="answer-detail">
    <dl>
      <dt>Milo’s answer</dt><dd>{selected ?? "The notebook did not support an answer."}</dd>
      {attempt.score === attempt.total || result.correct
        ? <><dt>Correct answer</dt><dd>{expected}</dd></>
        : <><dt>Correct answer</dt><dd className="muted">Hidden until your student passes. Explain the idea again, then retake.</dd></>}
      <dt>Milo’s reasoning</dt><dd>{result.reasoning}</dd>
    </dl>
    {result.notebookRefs.length > 0 && <div className="answer-evidence"><h3>Notes used in this attempt</h3><ul>{result.notebookRefs.map((id) => <li key={id}>{notes.get(id)?.claim ?? "This note is unavailable in the saved snapshot."}</li>)}</ul></div>}
    {gap && <div className="answer-gap"><h3>Explain next</h3><p>{gap.missingIdea}</p></div>}
    {!result.correct && onExplain && <button type="button" className="secondary explain-question" disabled={disabled} onClick={() => onExplain(result.questionText)}>Help Milo with this question</button>}
  </div>;
}
