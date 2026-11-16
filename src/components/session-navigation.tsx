export function SessionNavigation({ noteCount, hasAttempt }: { noteCount: number; hasAttempt: boolean }) {
  return <nav className="session-navigation" aria-label="Session sections">
    <a href="#explanation-title"><span className="session-step" aria-hidden="true">1</span>Chat</a>
    <a href="#student-notebook"><span className="session-step" aria-hidden="true">2</span>Notebook<span className="session-note-count">{noteCount}<span className="sr-only"> saved {noteCount === 1 ? "note" : "notes"}</span></span></a>
    <a href={hasAttempt ? "#exam-review" : "#student-exam"}><span className="session-step" aria-hidden="true">3</span>Exam</a>
  </nav>;
}
