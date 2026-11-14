import { describe, expect, it } from "vitest";
import { pickTopicOfTheDay } from "../src/ai/planner";
import type { TopicSummary } from "../src/lib/types";

const topic = (id: string, status: TopicSummary["status"], bestScore: number | null = null): TopicSummary =>
  ({ id, title: id, description: "", status, bestScore });

describe("topic of the day", () => {
  it("returns nothing when there are no topics", () => {
    expect(pickTopicOfTheDay([])).toBeNull();
  });

  it("prefers the failed topic with the lowest best score", () => {
    const topics = [topic("a", "passed", 3), topic("b", "failed", 2), topic("c", "not_started"), topic("d", "failed", 0)];
    expect(pickTopicOfTheDay(topics)?.topicId).toBe("d");
    expect(pickTopicOfTheDay(topics)?.reason).toMatch(/didn't pass/);
  });

  it("keeps exam order between failed topics with the same score", () => {
    expect(pickTopicOfTheDay([topic("a", "failed", 1), topic("b", "failed", 1)])?.topicId).toBe("a");
  });

  it("suggests the first untaught topic when nothing failed", () => {
    const pick = pickTopicOfTheDay([topic("a", "passed", 3), topic("b", "not_started"), topic("c", "not_started")]);
    expect(pick).toEqual({ topicId: "b", reason: expect.stringMatching(/haven't taught/) });
  });

  it("rotates a review topic by UTC day once everything is passed", () => {
    const topics = [topic("a", "passed", 3), topic("b", "passed", 3), topic("c", "passed", 3)];
    const day = (iso: string) => pickTopicOfTheDay(topics, new Date(iso))?.topicId;
    expect(day("2026-11-15T00:00:00Z")).toBe(day("2026-11-15T23:59:59Z"));
    expect(new Set([day("2026-11-15T12:00:00Z"), day("2026-11-16T12:00:00Z"), day("2026-11-17T12:00:00Z")]).size).toBe(3);
    expect(pickTopicOfTheDay(topics)?.reason).toMatch(/review/);
  });
});
