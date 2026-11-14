// Shared API contract. Change only after agreeing with the whole team.

export type TopicStatus = "not_started" | "failed" | "passed";

export interface TopicSummary {
  id: string;
  title: string;
  status: TopicStatus;
  bestScore: number | null;
}

export interface ChatMessage {
  id: string;
  role: "user" | "student";
  text: string;
  createdAt: string;
}

export interface NotebookEntry {
  id: string;
  claim: string;
  sourceMessageId: string;
}

export interface ExamAnswer {
  questionId: string;
  answer: string;
  correct: boolean;
  guessed: boolean;
  reasoning: string;
  notebookRefs: string[];
}

export interface ExamResult {
  results: ExamAnswer[];
  score: number;
  total: number;
}

export interface Gap {
  questionId: string;
  missingIdea: string;
}

export interface Progress {
  streak: number;
  topicOfTheDay: { topicId: string; reason: string } | null;
  gaps: Gap[];
}

// POST /api/sessions
export interface CreateSessionRequest { topicId: string }
export interface CreateSessionResponse { sessionId: string; firstMessage: ChatMessage }

// POST /api/sessions/:id/messages  -> streamed student reply
export interface SendMessageRequest { text: string }

// POST /api/sessions/:id/notebook
export interface NotebookResponse { notebook: NotebookEntry[] }

// POST /api/sessions/:id/exam
export type ExamResponse = ExamResult;

// GET /api/sessions/:id/debrief
export interface DebriefResponse { gaps: Gap[] }
