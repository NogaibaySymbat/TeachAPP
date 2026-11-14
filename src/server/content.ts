import "server-only";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { Exam, Question, Topic } from "@/lib/types";
import { ServiceError } from "./errors";

const identifier = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const examSchema = z.object({ id: identifier, title: z.string().min(1), description: z.string(), topics: z.array(identifier) });
const topicSchema = z.object({
  id: identifier, title: z.string().min(1), description: z.string(),
  keyIdeas: z.array(z.object({ id: identifier, label: z.string().min(1).optional(), text: z.string() })),
  misconceptions: z.array(z.string()),
});
const questionsSchema = z.array(z.object({
  id: identifier, text: z.string().min(1),
  options: z.array(z.object({ id: identifier, text: z.string().min(1) })).min(2),
  correctAnswer: identifier, requiredIdeaIds: z.array(identifier).min(1),
}));
const root = path.join(process.cwd(), "content", "exams");

async function readJson(file: string): Promise<unknown> {
  return JSON.parse(await readFile(file, "utf8"));
}

export async function getExams(): Promise<Exam[]> {
  const directories = await readdir(root, { withFileTypes: true });
  return Promise.all(directories.filter((entry) => entry.isDirectory()).map(async (entry) => {
    const exam = examSchema.parse(await readJson(path.join(root, entry.name, "exam.json")));
    if (exam.id !== entry.name) throw new Error("Exam ID must match its directory.");
    return exam;
  }));
}

export async function getTopics(): Promise<Topic[]> {
  const exams = await getExams();
  const topics = await Promise.all(exams.flatMap((exam) => exam.topics.map(async (id) => {
    const topic = topicSchema.parse(await readJson(path.join(root, exam.id, "topics", `${id}.json`)));
    if (topic.id !== id) throw new Error("Topic ID must match its manifest entry.");
    return topic;
  })));
  if (new Set(topics.map((topic) => topic.id)).size !== topics.length) {
    throw new Error("Topic IDs must be globally unique.");
  }
  return topics;
}

export async function getTopic(topicId: string): Promise<Topic> {
  const topic = (await getTopics()).find((item) => item.id === topicId);
  if (!topic) throw new ServiceError(404, "TOPIC_NOT_FOUND", "This topic could not be found.");
  return topic;
}

export async function getQuestions(topicId: string): Promise<Question[]> {
  const topic = await getTopic(topicId);
  const exam = (await getExams()).find((item) => item.topics.includes(topicId))!;
  const questions = questionsSchema.parse(await readJson(path.join(root, exam.id, "questions", `${topicId}.json`)));
  const ids = new Set<string>();
  for (const question of questions) {
    if (ids.has(question.id)) throw new Error("Question IDs must be unique.");
    ids.add(question.id);
    if (!question.options.some((option) => option.id === question.correctAnswer)) throw new Error("Invalid answer key.");
    if (new Set(question.options.map((option) => option.id)).size !== question.options.length) throw new Error("Duplicate option IDs.");
    if (question.requiredIdeaIds.some((id) => !topic.keyIdeas.some((idea) => idea.id === id))) throw new Error("Unknown required idea.");
  }
  return questions;
}
