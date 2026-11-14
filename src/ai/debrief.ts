import "server-only";
import type { ExamAnswer, Gap, NotebookEntry, Question, Topic } from "@/lib/types";
import { getQuestions, getTopic } from "@/server/content";

// Deterministic feedback uses the same content snapshot as grading. No third
// model call and no claim that an idea was necessarily absent from the notebook.
// It names the area to explain (the idea's label), never the idea's full text,
// so a retake measures a new explanation rather than a copied answer.
export function buildDebriefFromContent(
  answers: ExamAnswer[],
  questions: Pick<Question, "id" | "requiredIdeaIds">[],
  keyIdeas: Topic["keyIdeas"],
): Gap[] {
  const failed = new Set(answers.filter((answer) => !answer.correct).map((answer) => answer.questionId));
  const labels = new Map(keyIdeas.map((idea) => [idea.id, idea.label]));
  return questions.filter((question) => failed.has(question.id)).map((question) => {
    const areas = [...new Set(question.requiredIdeaIds)].map((id) => labels.get(id)?.trim()).filter((label): label is string => !!label);
    return {
      questionId: question.id,
      missingIdea: areas.length
        ? `Explain ${areas.join(" and ")} in your own words, then retake.`
        : "Explain the idea behind this question in your own words, then retake.",
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
