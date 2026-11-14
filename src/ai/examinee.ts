import type { NotebookEntry } from "@/lib/types";

export interface ExamQuestion {
  id: string;
  text: string;
  options: { id: string; text: string }[];
}

export interface ExamineeAnswer {
  questionId: string;
  answer: string;
  reasoning: string;
  notebookRefs: string[];
  guessed: boolean;
}

// The student answers using ONLY the notebook. It never sees the chat.
export async function answerQuestion(
  question: ExamQuestion,
  notebook: NotebookEntry[],
): Promise<ExamineeAnswer> {
  void question;
  void notebook;
  throw new Error("answerQuestion() is not implemented");
}
