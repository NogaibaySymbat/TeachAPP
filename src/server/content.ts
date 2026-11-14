// Loads exam content from /content. The engine must not hardcode any exam.
import { promises as fs } from "fs";
import path from "path";

const CONTENT_ROOT = path.join(process.cwd(), "content", "exams");

export async function readJson<T>(...segments: string[]): Promise<T> {
  const file = path.join(CONTENT_ROOT, ...segments);
  return JSON.parse(await fs.readFile(file, "utf8")) as T;
}

// TODO: loadExam(examId), loadTopic(examId, topicId), loadQuestions(examId, topicId)
