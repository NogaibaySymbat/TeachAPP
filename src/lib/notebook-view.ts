import type { LearningState, Message, NotebookEntry } from "./types";

export interface NotebookUpdate {
  revision: string;
  addedKeys: string[];
  removedCount: number;
}

// Extraction replaces database IDs. A note's evidence is its source and exact quote.
export function notebookEntryKey(entry: NotebookEntry): string {
  return JSON.stringify([entry.sourceMessageId, entry.claim]);
}

export function compareNotebookUpdate(before: NotebookEntry[], after: NotebookEntry[], revision: string): NotebookUpdate {
  const previous = new Set(before.map(notebookEntryKey));
  const next = new Set(after.map(notebookEntryKey));
  return {
    revision,
    addedKeys: [...next].filter((key) => !previous.has(key)),
    removedCount: [...previous].filter((key) => !next.has(key)).length,
  };
}

export function currentNotebookUpdate(update: NotebookUpdate | null, learning: LearningState): NotebookUpdate | null {
  return learning.notebookFresh && learning.notebookRevision === learning.revision && update?.revision === learning.revision ? update : null;
}

export function latestStudentExchange(messages: Message[]) {
  const explanationIndex = messages.findLastIndex((message) => message.role === "user");
  const explanation = messages[explanationIndex];
  if (!explanation) return null;
  const replies = messages.slice(explanationIndex + 1);
  const reply = replies.findLast((message) => message.role === "student" && message.replyToMessageId === explanation.id)
    // Older sessions did not store replyToMessageId; only use replies after this explanation.
    ?? replies.findLast((message) => message.role === "student" && !message.replyToMessageId);
  return { explanation, reply, number: messages.slice(0, explanationIndex + 1).filter((message) => message.role === "user").length };
}
