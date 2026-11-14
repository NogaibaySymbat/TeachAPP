import type { ChatMessage, NotebookEntry } from "@/lib/types";

// Extracts what the user actually taught. Never adds or corrects anything.
export async function extractNotebook(
  topicId: string,
  userMessages: ChatMessage[],
): Promise<Omit<NotebookEntry, "id">[]> {
  void topicId;
  void userMessages;
  throw new Error("extractNotebook() is not implemented");
}
