"use client";

import { useEffect, useRef } from "react";
import type { TopicSummary } from "@/lib/types";

const statusLabels = { not_started: "Not started", failed: "Ready to revisit", passed: "Student passed" };

export function TopicChoice({ topics, selected, disabled, onChange }: {
  topics: TopicSummary[];
  selected: TopicSummary;
  disabled: boolean;
  onChange: (id: string) => void;
}) {
  const disclosure = useRef<HTMLDetailsElement>(null);
  const trigger = useRef<HTMLElement>(null);

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      const element = disclosure.current;
      if (element?.open && event.target instanceof Node && !element.contains(event.target)) element.open = false;
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);

  function choose(id: string) {
    if (disabled) return;
    onChange(id);
    if (disclosure.current) disclosure.current.open = false;
    trigger.current?.focus();
  }

  return <div className="topic-choice">
    <span id="topic-choice-label" className="topic-choice-label">Choose a topic</span>
    <details ref={disclosure} onKeyDown={(event) => {
      if (event.key === "Escape" && disclosure.current?.open) {
        event.preventDefault(); event.stopPropagation();
        disclosure.current.open = false; trigger.current?.focus();
      }
    }} onBlur={(event) => {
      if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;
    }}>
      <summary ref={trigger} aria-labelledby="topic-choice-label topic-choice-value" aria-disabled={disabled} onClick={(event) => { if (disabled) event.preventDefault(); }}>
        <span className="topic-choice-current"><strong id="topic-choice-value">{selected.title}</strong><span>{statusLabels[selected.status]}{selected.bestScore !== null ? ` · Best score: ${selected.bestScore}` : ""}</span></span>
        <svg className="topic-choice-chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </summary>
      <div className="topic-choice-menu" role="group" aria-label="Available topics">
        {topics.map((topic) => <button type="button" key={topic.id} className="topic-choice-option" aria-pressed={topic.id === selected.id} disabled={disabled} onClick={() => choose(topic.id)}>
          <span><strong>{topic.title}</strong><span className="topic-choice-status">{statusLabels[topic.status]}{topic.bestScore !== null ? ` · Best score: ${topic.bestScore}` : ""}</span></span>
          <svg className="topic-choice-check" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>
        </button>)}
      </div>
    </details>
  </div>;
}
