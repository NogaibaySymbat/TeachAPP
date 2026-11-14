import type { TopicSummary } from "@/lib/types";

export interface TopicOfTheDay { topicId: string; reason: string }

// Picks the topic of the day without a model call:
// 1. a topic the student failed, lowest best score first;
// 2. otherwise the first topic not taught yet, in exam order;
// 3. otherwise a review topic that rotates once per UTC day.
// The choice is deterministic for the same progress and day.
export function pickTopicOfTheDay(topics: TopicSummary[], now: Date = new Date()): TopicOfTheDay | null {
  if (topics.length === 0) return null;

  const failed = topics
    .map((topic, index) => ({ topic, index }))
    .filter(({ topic }) => topic.status === "failed")
    .sort((a, b) => (a.topic.bestScore ?? -1) - (b.topic.bestScore ?? -1) || a.index - b.index);
  if (failed.length > 0) {
    return { topicId: failed[0].topic.id, reason: "Your student didn't pass this one last time. Explain the gaps, then let them retake it." };
  }

  const fresh = topics.find((topic) => topic.status === "not_started");
  if (fresh) return { topicId: fresh.id, reason: "You haven't taught this topic yet. Start with the big idea." };

  const day = Math.floor(now.getTime() / 86_400_000);
  const review = topics[day % topics.length];
  return { topicId: review.id, reason: "Every topic is passed. A quick review keeps it fresh." };
}
