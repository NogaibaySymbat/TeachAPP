// Correctness is decided here by the answer key, never by the model.

export interface KeyedQuestion {
  id: string;
  correctOptionId: string;
}

export interface RawAnswer {
  questionId: string;
  answer: string;
  guessed: boolean;
  notebookRefs: string[];
}

export function isCorrect(question: KeyedQuestion, answer: RawAnswer): boolean {
  // A guessed answer, or one with no notebook reference, never counts.
  if (answer.guessed || answer.notebookRefs.length === 0) return false;
  return answer.answer === question.correctOptionId;
}

export function score(questions: KeyedQuestion[], answers: RawAnswer[]): number {
  const byId = new Map(answers.map((a) => [a.questionId, a]));
  return questions.filter((q) => {
    const a = byId.get(q.id);
    return a ? isCorrect(q, a) : false;
  }).length;
}
