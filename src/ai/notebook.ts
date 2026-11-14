import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ChatMessage, NotebookEntry } from "@/lib/types";
import { getTopic } from "@/server/content";
import { ServiceError } from "@/server/errors";
import { completeJson } from "./client";
import { notebookFormat, notebookOutput } from "./schemas";

export const MAX_NOTEBOOK_MESSAGES = 24;
export const MAX_NOTEBOOK_CHARACTERS = 12_000;

// Extracts what the user actually taught. Never adds or corrects anything.
export async function extractNotebook(
  topicId: string,
  userMessages: ChatMessage[],
): Promise<Omit<NotebookEntry, "id">[]> {
  const sources = userMessages.filter((message) => message.role === "user" && message.text.trim())
    .map(({ id, text }) => ({ id, text }));
  if (!sources.length) return [];
  if (sources.length > MAX_NOTEBOOK_MESSAGES || sources.reduce((sum, message) => sum + message.text.length, 0) > MAX_NOTEBOOK_CHARACTERS) {
    throw new ServiceError(400, "AI_CONTEXT_TOO_LONG", "This session is too long for the demo notebook. Please start a new session.");
  }
  if (new Set(sources.map((message) => message.id)).size !== sources.length) {
    throw new ServiceError(400, "AI_INVALID_CONTEXT", "The notebook could not identify its source messages.");
  }
  const [topic, prompt] = await Promise.all([
    getTopic(topicId),
    readFile(path.join(process.cwd(), "prompts", "notebook.md"), "utf8"),
  ]);
  const byId = new Map(sources.map((message) => [message.id, message.text]));
  return completeJson([
    { role: "system", content: prompt },
    // Only the topic title provides context. Never inject key ideas or answers.
    { role: "user", content: JSON.stringify({ topic: topic.title, messages: sources }) },
  ], (value) => {
    const { entries } = notebookOutput.parse(value);
    const seen = new Set<string>();
    for (const entry of entries) {
      const source = byId.get(entry.sourceMessageId);
      const key = `${entry.sourceMessageId}\u0000${entry.claim}`;
      if (!entry.claim.trim() || entry.claim !== entry.claim.trim() || !source?.includes(entry.claim) || seen.has(key)) {
        throw new Error("Notebook claims must quote a unique, supplied user source exactly.");
      }
      seen.add(key);
    }
    return entries;
  }, { jsonSchema: notebookFormat, maxOutputTokens: 1_024 });
}
