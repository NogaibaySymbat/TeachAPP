import "server-only";
import type { ExamAnswer, Gap, NotebookEntry, Question, Topic } from "@/lib/types";
import { getQuestions, getTopic } from "@/server/content";

// Deterministic feedback uses the same content snapshot as grading. No third
// model call and no claim that an idea was necessarily absent from the notebook.
export function buildDebriefFromContent(
  answers: ExamAnswer[],
  questions: Pick<Question, "id" | "requiredIdeaIds">[],
  keyIdeas: Topic["keyIdeas"],
): Gap[] {
  const failed = new Set(answers.filter((answer) => !answer.correct).map((answer) => answer.questionId));
  const ideas = new Map(keyIdeas.map((idea) => [idea.id, idea.text]));
  return questions.filter((question) => failed.has(question.id)).map((question) => {
    const review = [...new Set(question.requiredIdeaIds)].map((id) => ideas.get(id)).filter((idea): idea is string => !!idea?.trim());
    return {
      questionId: question.id,
      missingIdea: review.length ? `Review and explain: ${review.join(" ")}` : "Explain the idea behind this question, then try again.",
    };
  });
}

// Convenience wrapper. Orchestration should use buildDebriefFromContent with
// its grading snapshot and persist the resulting gaps with the attempt.
export async function buildDebrief(
  topicId: string,
  answers: ExamAnswer[],
  notebook: NotebookEntry[],
): Promise<Gap[]> {
  void notebook;
  if (answers.every((answer) => answer.correct)) return [];
  const [topic, questions] = await Promise.all([getTopic(topicId), getQuestions(topicId)]);
  return buildDebriefFromContent(answers, questions, topic.keyIdeas);
}
