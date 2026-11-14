import type { TopicSummary } from "@/lib/types";

// Picks the topic of the day: failed topics first, then not started.
// Plain code is enough here; no model call needed.
export function pickTopicOfTheDay(
  topics: TopicSummary[],
): { topicId: string; reason: string } | null {
  const failed = topics.find((t) => t.status === "failed");
  if (failed) return { topicId: failed.id, reason: "Your student failed this topic last time." };
  const fresh = topics.find((t) => t.status === "not_started");
  if (fresh) return { topicId: fresh.id, reason: "You haven't taught this topic yet." };
  return null;
}
