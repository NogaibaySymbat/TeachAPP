"use client";

import type { TopicSummary } from "@/lib/types";

const statusLabels = { not_started: "Not started", failed: "Ready to revisit", passed: "Student passed" };

/** Every topic is visible as a card; choosing one only selects it, the start button begins the session. */
export function TopicChoice({ topics, selected, todayId, disabled, onChange }: {
  topics: TopicSummary[];
  selected: TopicSummary;
  todayId?: string;
  disabled: boolean;
  onChange: (id: string) => void;
}) {
  return <div className="topic-choice">
    <div className="topic-cards" role="group" aria-label="Topics">
      {topics.map((topic) => <button type="button" key={topic.id} className="topic-card" aria-pressed={topic.id === selected.id} disabled={disabled} onClick={() => onChange(topic.id)}>
        <strong>{topic.title}</strong>
        <span className="topic-card-status">{statusLabels[topic.status]}{topic.bestScore !== null ? ` · Best score: ${topic.bestScore}` : ""}</span>
        {topic.id === todayId && <span className="topic-card-badge">Today&apos;s topic</span>}
      </button>)}
    </div>
  </div>;
}
