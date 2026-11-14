export type TopicStatus = "not_started" | "failed" | "passed";

export interface Exam {
  id: string;
  title: string;
  description: string;
  topics: string[];
}

export interface Topic {
  id: string;
  title: string;
  description: string;
  keyIdeas: { id: string; text: string }[];
  misconceptions: string[];
}

export interface TopicSummary {
  id: string;
  title: string;
  description: string;
  status: TopicStatus;
  bestScore: number | null;
}

export interface Session {
  id: string;
  topicId: string;
  startedAt: string;
  finishedAt: string | null;
}

export interface Message {
  id: string;
  role: "user" | "student";
  text: string;
  createdAt: string;
}

// Compatibility names used by the team's AI module scaffold.
export type ChatMessage = Message;

export interface NotebookEntry {
  id: string;
  claim: string;
  sourceMessageId: string;
}

export interface Question {
  id: string;
  text: string;
  options: { id: string; text: string }[];
  correctAnswer: string;
  requiredIdeaIds: string[];
}

export interface ExamineeAnswer {
  questionId: string;
  answer: string | null;
  reasoning: string;
  notebookRefs: string[];
  guessed: boolean;
}

export interface GradedAnswer extends ExamineeAnswer {
  correct: boolean;
}

export type ExamAnswer = GradedAnswer;

export interface ExamResult {
  results: GradedAnswer[];
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

export interface CreateSessionRequest { topicId: string }
export interface CreateSessionResponse { sessionId: string; firstMessage: string | null }
export interface SendMessageRequest { text: string }
export interface SendMessageResponse { message: Message }
export interface NotebookResponse { notebook: NotebookEntry[] }
export type ExamResponse = ExamResult;
export interface DebriefResponse { gaps: Gap[] }
export interface SessionResponse { session: Session; messages: Message[]; notebook: NotebookEntry[] }
export interface SessionHistoryItem extends Session {
  topicTitle: string;
  lastActivityAt: string;
  messageCount: number;
  latestAttempt: { score: number; total: number } | null;
}
export interface SessionHistoryResponse {
  sessions: SessionHistoryItem[];
  nextOffset: number | null;
}
export interface ApiError { error: { code: string; message: string } }
