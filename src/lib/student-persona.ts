import type { SessionResponse } from "./types";

export type StudentExpression = "neutral" | "curious" | "learning" | "engaged" | "celebrating";
export type StudentActivity = "idle" | "listening" | "thinking" | "writing" | "exam" | "review" | "paused";
export interface StudentPersonaState {
  expression: StudentExpression;
  activity: StudentActivity;
  status: string;
}

interface Activity {
  listening?: boolean;
  replying?: boolean;
  writing?: boolean;
  examining?: boolean;
  reviewing?: boolean;
}

/** Expressions acknowledge saved notes, not correctness or estimated understanding. */
export function getStudentPersona(
  data: Pick<SessionResponse, "notebook" | "learning" | "latestAttempt" | "ai">,
  active: Activity = {},
): StudentPersonaState {
  // Repeated quotes or regenerated database IDs must not inflate the expression.
  const notes = new Set(data.notebook.map((note) => note.claim.trim()).filter(Boolean)).size;
  const attempt = data.latestAttempt;
  const passed = data.learning.notebookFresh && attempt?.revision === data.learning.revision
    && attempt.total > 0 && attempt.score === attempt.total;
  const expression: StudentExpression = passed && !active.reviewing ? "celebrating" : notes === 0 ? "neutral"
    : notes === 1 ? "curious" : notes === 2 ? "learning" : "engaged";
  const activity: StudentActivity = active.listening ? "listening" : active.examining ? "exam"
    : active.writing ? "writing" : active.replying ? "thinking" : active.reviewing ? "review" : !data.ai.available ? "paused" : "idle";
  const progress = notes === 0 ? "My notebook is empty. Teach me one idea."
    : notes === 1 ? "I’ve saved my first note."
    : `I have ${notes} notes to try in the exam.`;
  const status = activity === "listening" ? "Listening to your explanation…"
    : activity === "exam" ? "Taking the practice exam…"
    : activity === "writing" ? "Writing in my notebook…"
    : activity === "thinking" ? "Thinking about your explanation…"
    : activity === "review" ? "The exam is saved. Let’s review each answer."
    : activity === "paused" ? `Replies paused · ${notes} saved ${notes === 1 ? "note" : "notes"}`
    : passed ? "I passed the latest practice exam!" : progress;
  return { expression, activity, status };
}
