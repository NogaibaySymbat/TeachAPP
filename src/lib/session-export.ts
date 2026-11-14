import type { SessionExport } from "./types";

// Plain text keeps user text inert: no HTML, Markdown links or scripts are executed.
export function sessionExportText(data: SessionExport): string {
  const lines = ["TeachAPP — saved teaching session", data.topic.title, data.topic.description,
    `Exported: ${data.exportedAt}`, `Session started: ${data.session.startedAt}`,
    "Practice results do not predict your real exam score.",
    "This is a readable copy, not a sign-in key or an importable account backup.", "", "CONVERSATION", ""];
  if (!data.messages.length) lines.push("No saved messages.");
  data.messages.forEach((message, index) => lines.push(`[${index + 1}] ${message.role === "user" ? "You" : "AI student"} — ${message.createdAt}`, message.text, ""));
  const sourceLabel = (id: string) => {
    const index = data.messages.findIndex((message) => message.id === id);
    return index < 0 ? "Source explanation unavailable" : `Conversation message [${index + 1}]`;
  };
  lines.push("CURRENT NOTEBOOK", data.notebookFresh ? "Up to date with saved explanations." : "Not up to date with saved explanations.", "");
  if (!data.notebook.length) lines.push("No saved notes.");
  data.notebook.forEach((note) => lines.push(note.claim, sourceLabel(note.sourceMessageId), ""));
  lines.push("SAVED EXAM ATTEMPTS — oldest first", "");
  if (!data.attempts.length) lines.push("No saved exam attempts.");
  // Mirrors the review screen: correct options appear only once a topic is passed.
  const passed = data.attempts.some((attempt) => attempt.score === attempt.total);
  data.attempts.forEach((attempt, index) => {
    lines.push(`Attempt ${index + 1}: ${attempt.score}/${attempt.total} — ${attempt.createdAt}`, "");
    const notes = new Map(attempt.notebookSnapshot.map((note) => [note.id, note]));
    attempt.results.forEach((result, questionIndex) => {
      lines.push(`${questionIndex + 1}. ${result.questionText}`);
      result.options.forEach((option) => lines.push(`  ${option.id}: ${option.text}`));
      lines.push(`Student answer: ${result.answer ?? "No supported answer"}`, `Correct answer: ${passed || result.correct ? result.correctAnswer : "hidden until the topic is passed"}`,
        `Result: ${result.correct ? "Correct" : result.guessed ? "No supported answer" : "Incorrect"}`, `Reasoning: ${result.reasoning}`);
      result.notebookRefs.forEach((id) => {
        const note = notes.get(id);
        lines.push(`Cited note: ${note?.claim ?? "Unavailable in saved snapshot"}`);
        if (note) lines.push(sourceLabel(note.sourceMessageId));
      });
      const gap = attempt.gaps?.find((gap) => gap.questionId === result.questionId);
      if (gap) lines.push(`Review: ${gap.missingIdea}`);
      lines.push("");
    });
    lines.push("Notebook at this attempt:");
    if (!attempt.notebookSnapshot.length) lines.push("No notes.");
    attempt.notebookSnapshot.forEach((note) => lines.push(note.claim, sourceLabel(note.sourceMessageId)));
    lines.push("");
  });
  if (data.legacyAttempts.length) {
    lines.push("OLDER RESULTS WITHOUT SAVED QUESTION OR NOTEBOOK SNAPSHOTS", "These records are preserved separately and are not used for before/after comparison.", "");
    for (const attempt of data.legacyAttempts) {
      lines.push(`${attempt.score}/${attempt.total} — ${attempt.createdAt}`);
      for (const answer of attempt.results) lines.push(`Question ID: ${answer.questionId}`, `Student answer: ${answer.answer ?? "No answer"}`, `Correct: ${answer.correct}`, `Reasoning: ${answer.reasoning}`);
      lines.push("");
    }
  }
  return lines.join("\n") + "\n";
}
