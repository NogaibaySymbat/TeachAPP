"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { sessionExportText } from "@/lib/session-export";
import type { SessionExport } from "@/lib/types";

export function SessionExportControls({ sessionId, disabled }: { sessionId: string; disabled: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => { active.current?.abort(); }, []);

  async function download(format: "txt" | "json") {
    if (active.current || disabled) return;
    const controller = new AbortController();
    active.current = controller;
    setPending(true); setError(""); setStatus("");
    try {
      const data = await api<SessionExport>(`/api/sessions/${encodeURIComponent(sessionId)}/export`, { signal: controller.signal });
      if (controller.signal.aborted) return;
      const body = format === "txt" ? sessionExportText(data) : JSON.stringify(data, null, 2);
      const url = URL.createObjectURL(new Blob([body], { type: format === "txt" ? "text/plain;charset=utf-8" : "application/json;charset=utf-8" }));
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `teachapp-${sessionId}.${format}`;
      document.body.append(anchor);
      try { anchor.click(); } finally { anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
      setStatus("Download requested. Check your browser’s downloads.");
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "The export could not be downloaded. Try again.");
    } finally {
      if (!controller.signal.aborted) setPending(false);
      active.current = null;
    }
  }

  return <details className="session-export">
    <summary>Download this session</summary>
    <p className="muted">Keep a copy of saved messages, notes and exam attempts before clearing browser data. Unsaved drafts are not included. Importing a copy back into TeachAPP is not available.</p>
    <div className="export-actions"><button className="secondary" disabled={disabled || pending} onClick={() => void download("txt")}>Download text</button><button className="secondary" disabled={disabled || pending} onClick={() => void download("json")}>Download JSON</button></div>
    <p role="status" className="muted">{pending ? "Preparing your download…" : status}</p>
    {error && <p role="alert" className="notice error">{error}</p>}
  </details>;
}
