import "server-only";
import { z } from "zod";

export const MAX_NOTEBOOK_ENTRIES = 12;
export const MAX_EXAM_QUESTIONS = 6;

const id = z.string().min(1).max(128);

export const notebookOutput = z.strictObject({
  entries: z.array(z.strictObject({
    claim: z.string().min(2).max(500),
    sourceMessageId: id,
  })).max(MAX_NOTEBOOK_ENTRIES),
});

export const examineeOutput = z.strictObject({
  answers: z.array(z.strictObject({
    questionId: id,
    answer: id.nullable(),
    reasoning: z.string().min(1).max(300),
    notebookRefs: z.array(id).max(MAX_NOTEBOOK_ENTRIES),
    guessed: z.boolean(),
  })).max(MAX_EXAM_QUESTIONS),
});

// Use one schema for both provider constraints and local shape validation.
// Business rules (real sources, unique questions, supported option IDs) are
// checked by the caller as well; JSON schema alone cannot establish grounding.
function format(name: string, validator: z.ZodType) {
  const schema = z.toJSONSchema(validator);
  delete schema.$schema;
  return { name, schema };
}

export const notebookFormat = format("teachapp_notebook", notebookOutput);
export const examineeFormat = format("teachapp_exam", examineeOutput);
