import type { ExamAnswer, Gap, NotebookEntry } from "@/lib/types";

// Explains which idea was missing for each failed question.
export async function buildDebrief(
  topicId: string,
  answers: ExamAnswer[],
  notebook: NotebookEntry[],
): Promise<Gap[]> {
  void topicId;
  void answers;
  void notebook;
  throw new Error("buildDebrief() is not implemented");
}
