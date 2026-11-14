import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ExamineeAnswer, NotebookEntry } from "@/lib/types";
import { ServiceError } from "@/server/errors";
import { completeJson } from "./client";
import { examineeFormat, examineeOutput, MAX_EXAM_QUESTIONS, MAX_NOTEBOOK_ENTRIES } from "./schemas";

export type { ExamineeAnswer } from "@/lib/types";

export interface ExamQuestion {
  id: string;
  text: string;
  options: { id: string; text: string }[];
}

function abstain(questionId: string): ExamineeAnswer {
  return {
    questionId, answer: null, reasoning: "My notebook does not support an answer to this question.",
    notebookRefs: [], guessed: true,
  };
}

// One bounded request for the whole quiz. Only public question fields and
// notebook claims cross this boundary, even if callers pass richer objects.
export async function answerQuestions(questions: ExamQuestion[], notebook: NotebookEntry[]): Promise<ExamineeAnswer[]> {
  if (!questions.length) return [];
  if (questions.length > MAX_EXAM_QUESTIONS || notebook.length > MAX_NOTEBOOK_ENTRIES) {
    throw new ServiceError(400, "AI_CONTEXT_TOO_LONG", "This exam is too long for the demo.");
  }
  const questionIds = new Set(questions.map((question) => question.id));
  const notebookIds = new Set(notebook.map((entry) => entry.id));
  if (questionIds.size !== questions.length || notebookIds.size !== notebook.length) {
    throw new ServiceError(400, "AI_INVALID_CONTEXT", "The exam contains duplicate identifiers.");
  }
  if (!notebook.length) return questions.map((question) => abstain(question.id));

  const publicQuestions = questions.map(({ id, text, options }) => ({ id, text, options: options.map(({ id, text }) => ({ id, text })) }));
  const claims = notebook.map(({ id, claim }) => ({ id, claim }));
  const prompt = await readFile(path.join(process.cwd(), "prompts", "examinee.md"), "utf8");
  return completeJson([
    { role: "system", content: prompt },
    { role: "user", content: JSON.stringify({ questions: publicQuestions, notebook: claims }) },
  ], (value) => {
    const { answers } = examineeOutput.parse(value);
    if (answers.length !== questions.length || new Set(answers.map((answer) => answer.questionId)).size !== answers.length
      || answers.some((answer) => !questionIds.has(answer.questionId))) {
      throw new Error("The exam must contain exactly one answer for every supplied question.");
    }
    return questions.map((question) => {
      const answer = answers.find((item) => item.questionId === question.id)!;
      if (answer.answer !== null && !question.options.some((option) => option.id === answer.answer)) {
        throw new Error("Unknown answer option.");
      }
      const refs = answer.notebookRefs;
      if (answer.guessed || answer.answer === null || !refs.length || refs.some((id) => !notebookIds.has(id))
        || new Set(refs).size !== refs.length) {
        return abstain(question.id);
      }
      return answer;
    });
  }, { jsonSchema: examineeFormat, maxOutputTokens: 768 });
}

// Compatibility wrapper for callers that need a single question.
export async function answerQuestion(
  question: ExamQuestion,
  notebook: NotebookEntry[],
): Promise<ExamineeAnswer> {
  return (await answerQuestions([question], notebook))[0];
}
