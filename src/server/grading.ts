import type { ExamResult, ExamineeAnswer, NotebookEntry, Question } from "@/lib/types";

export function gradeAnswers(questions: Question[], answers: ExamineeAnswer[], notebook: NotebookEntry[]): ExamResult {
  const entryIds = new Set(notebook.map((entry) => entry.id));
  const results = questions.map((question) => {
    const matches = answers.filter((answer) => answer.questionId === question.id);
    const answer = matches.length === 1 ? matches[0] : undefined;
    const supported = Boolean(answer && !answer.guessed && answer.notebookRefs.length > 0
      && answer.notebookRefs.every((id) => entryIds.has(id)));
    return {
      questionId: question.id,
      answer: answer?.answer ?? null,
      reasoning: answer?.reasoning ?? "No answer was submitted.",
      notebookRefs: answer?.notebookRefs ?? [],
      guessed: !supported,
      correct: supported && answer?.answer === question.correctAnswer,
    };
  });
  return { results, score: results.filter((result) => result.correct).length, total: questions.length };
}
