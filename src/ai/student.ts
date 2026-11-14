import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ChatMessage, NotebookEntry } from "@/lib/types";
import { complete, type ModelMessage } from "./client";
import { getTopic } from "@/server/content";
import { ServiceError } from "@/server/errors";

export interface StudentInput {
  topicId: string;
  history: ChatMessage[];
  notebook: NotebookEntry[];
}

export async function buildStudentMessages(input: StudentInput): Promise<ModelMessage[]> {
  const latest = input.history.at(-1);
  if (!latest || latest.role !== "user" || !latest.text.trim()) {
    throw new ServiceError(400, "AI_EXPLANATION_REQUIRED", "Save an explanation before asking your student to reply.");
  }
  if (latest.text.length > 4000) {
    throw new ServiceError(400, "AI_EXPLANATION_TOO_LONG", "Your explanation is saved. Send a shorter explanation of up to 4,000 characters to get a student reply.");
  }
  const topic = await getTopic(input.topicId);
  const template = await readFile(path.join(process.cwd(), "prompts", "student.md"), "utf8");
  const history: ModelMessage[] = [];
  let characters = 0;
  for (const message of input.history.slice(-12).toReversed()) {
    if (characters + message.text.length > 12000) break;
    characters += message.text.length;
    history.unshift({ role: message.role === "student" ? "assistant" : "user", content: message.text });
  }
  // Keep a conversation boundary when old context is dropped.
  while (history[0]?.role === "assistant") history.shift();
  return [{ role: "system", content: template.replace("{{topicTitle}}", topic.title.slice(0, 200)) }, ...history];
}

export async function completeStudentReply(input: StudentInput): Promise<string> {
  return complete(await buildStudentMessages(input));
}

// Compatibility adapter for the scaffold; this first integration returns one full reply.
export async function* studentReply(input: StudentInput): AsyncGenerator<string> {
  yield await completeStudentReply(input);
}
