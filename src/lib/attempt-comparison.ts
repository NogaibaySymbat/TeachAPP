import type { ExamReviewAnswer, NotebookEntry, SavedExamAttempt } from "./types";

function questionSignature(question: ExamReviewAnswer) {
  return JSON.stringify([question.questionId, question.questionText, question.correctAnswer,
    [...question.options].sort((a, b) => a.id.localeCompare(b.id)).map(({ id, text }) => [id, text])]);
}
const noteSignature = (note: NotebookEntry) => JSON.stringify([note.sourceMessageId, note.claim]);

export function compareAttempts(previous: SavedExamAttempt, current: SavedExamAttempt) {
  const oldQuestions = new Map(previous.results.map((result) => [result.questionId, result]));
  const comparable = previous.id !== current.id && previous.total === current.total
    && previous.results.length === current.results.length
    && current.results.every((result) => {
      const old = oldQuestions.get(result.questionId);
      return old && questionSignature(old) === questionSignature(result);
    });
  const oldNotes = new Set(previous.notebookSnapshot.map(noteSignature));
  const addedNotes = current.notebookSnapshot.filter((note) => !oldNotes.has(noteSignature(note)));
  const improved = comparable ? current.results.filter((result) => result.correct && !oldQuestions.get(result.questionId)!.correct) : [];
  const regressed = comparable ? current.results.filter((result) => !result.correct && oldQuestions.get(result.questionId)!.correct) : [];
  const newEvidence = new Set(improved.flatMap((result) => result.notebookRefs));
  return {
    comparable, delta: comparable ? current.score - previous.score : null,
    improved, regressed, addedNotes,
    newlyCitedNotes: addedNotes.filter((note) => newEvidence.has(note.id)),
  };
}
