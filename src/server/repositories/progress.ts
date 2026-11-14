import "server-only";
import type { TopicSummary } from "@/lib/types";
import { getTopics } from "../content";
import { getDatabase } from "../db";

export async function getTopicSummaries(userId: string): Promise<TopicSummary[]> {
  const topics = await getTopics();
  if (!topics.length) return [];
  const progress = await getDatabase().query<{ topic_id: string; status: TopicSummary["status"]; best_score: number | null }>(
    "SELECT topic_id, status, best_score FROM topic_progress WHERE user_id = $1", [userId],
  );
  return topics.map((topic) => {
    const saved = progress.rows.find((row) => row.topic_id === topic.id);
    return { id: topic.id, title: topic.title, description: topic.description, status: saved?.status ?? "not_started", bestScore: saved?.best_score ?? null };
  });
}

export async function getStreak(userId: string): Promise<number> {
  const result = await getDatabase().query<{ day: string }>(
    `SELECT DISTINCT to_char(m.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day
     FROM messages m JOIN sessions s ON s.id = m.session_id
     WHERE s.user_id = $1 AND m.role = 'user' ORDER BY day DESC`, [userId],
  );
  const dates = new Set(result.rows.map((row) => row.day));
  const cursor = new Date();
  const day = () => cursor.toISOString().slice(0, 10);
  if (!dates.has(day())) cursor.setUTCDate(cursor.getUTCDate() - 1);
  let streak = 0;
  while (dates.has(day())) { streak++; cursor.setUTCDate(cursor.getUTCDate() - 1); }
  return streak;
}
