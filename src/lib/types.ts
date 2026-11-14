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
  // label names the area of an idea without giving away its content.
  keyIdeas: { id: string; label?: string; text: string }[];
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
  replyToMessageId?: string;
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
export interface StudentReplyRequest { messageId: string }
export interface StudentReplyResponse { message: Message }
export interface LearningState {
  revision: string;
  notebookRevision: string | null;
  notebookFresh: boolean;
  questionCount: number;
}
export interface ExamReviewAnswer extends GradedAnswer {
  questionText: string;
  options: { id: string; text: string }[];
  correctAnswer: string;
}
export interface SavedExamAttempt extends ExamResult {
  id: string;
  createdAt: string;
  revision: string;
  results: ExamReviewAnswer[];
  notebookSnapshot: NotebookEntry[];
  gaps: Gap[] | null;
}
export interface NotebookResponse { notebook: NotebookEntry[]; learning: LearningState }
export interface ExamResponse { attempt: SavedExamAttempt }
export interface DebriefResponse { gaps: Gap[]; attemptId: string }
export interface SessionResponse {
  session: Session;
  topic: Pick<Topic, "id" | "title" | "description">;
  messages: Message[];
  notebook: NotebookEntry[];
  learning: LearningState;
  latestAttempt: SavedExamAttempt | null;
  previousAttempt: SavedExamAttempt | null;
  ai: { available: boolean; message: string | null };
}
export interface SessionExport {
  formatVersion: 1;
  exportedAt: string;
  topic: Pick<Topic, "id" | "title" | "description">;
  session: Session;
  messages: Message[];
  notebook: NotebookEntry[];
  notebookFresh: boolean;
  // Oldest first; each attempt carries its own question and notebook snapshots.
  attempts: SavedExamAttempt[];
  // Before immutable question/notebook snapshots were introduced.
  legacyAttempts: (ExamResult & { id: string; createdAt: string })[];
}
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
