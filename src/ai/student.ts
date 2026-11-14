import type { ChatMessage, NotebookEntry } from "@/lib/types";

export interface StudentInput {
  topicId: string;
  history: ChatMessage[];
  notebook: NotebookEntry[];
}

// Streams the student's next chat reply.
export async function* studentReply(input: StudentInput): AsyncGenerator<string> {
  void input;
  throw new Error("studentReply() is not implemented");
}
