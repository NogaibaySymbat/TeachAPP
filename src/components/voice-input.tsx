"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { createSpeechController, getSpeechSupport, type SpeechController, type SpeechSnapshot } from "@/lib/speech-recognition";

const EMPTY_SPEECH: SpeechSnapshot = { state: "idle", finalText: "", interimText: "", error: null, limited: false };
const subscribe = () => () => {};
const serverSupport = () => "checking" as const;
function browserSupport() {
  const support = getSpeechSupport();
  return support.available ? "available" : support.code;
}

function MicrophoneIcon({ stop }: { stop: boolean }) {
  return stop ? <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="2" /></svg>
    : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11v1a7 7 0 0 0 14 0v-1M12 19v3M8 22h8" /></svg>;
}

interface VoiceInputProps {
  value: string;
  disabled: boolean;
  onAppend: (text: string) => void;
  onActiveChange: (active: boolean) => void;
}

export function VoiceInput({ value, disabled, onAppend, onActiveChange }: VoiceInputProps) {
  const support = useSyncExternalStore(subscribe, browserSupport, serverSupport);
  const [speech, setSpeech] = useState<SpeechSnapshot>(EMPTY_SPEECH);
  const [language, setLanguage] = useState("ru-RU");
  const controller = useRef<SpeechController | null>(null);
  const id = useId();
  const active = speech.state !== "idle";
  const separator = value && !/\s$/u.test(value) ? " " : "";
  const remaining = Math.max(0, 4000 - value.length - separator.length);
  const fits = speech.finalText.length <= remaining;

  useEffect(() => {
    const detected = getSpeechSupport();
    if (!detected.available) return;
    const recognition = createSpeechController({
      Recognition: detected.Recognition,
      onChange: (snapshot) => {
        setSpeech(snapshot);
        onActiveChange(snapshot.state !== "idle");
      },
    });
    controller.current = recognition;
    const stopWhenHidden = () => { if (document.visibilityState === "hidden") recognition.cancel(); };
    const stopOnPageHide = () => recognition.cancel();
    document.addEventListener("visibilitychange", stopWhenHidden);
    window.addEventListener("pagehide", stopOnPageHide);
    return () => {
      recognition.dispose();
      controller.current = null;
      document.removeEventListener("visibilitychange", stopWhenHidden);
      window.removeEventListener("pagehide", stopOnPageHide);
      onActiveChange(false);
    };
  }, [onActiveChange]);

  useEffect(() => { if (disabled) controller.current?.cancel(); }, [disabled]);

  function toggle() {
    if (speech.state === "starting") controller.current?.cancel();
    else if (speech.state === "listening") controller.current?.stop();
    else if (speech.state === "idle" && !disabled && remaining > 0 && !speech.finalText) {
      controller.current?.start(language, remaining);
    }
  }

  function discard() {
    controller.current?.clear();
  }

  function useText() {
    if (active || disabled || !fits || !speech.finalText) return;
    onAppend(speech.finalText);
    discard();
  }

  const label = speech.state === "starting" ? "Cancel microphone" : speech.state === "listening" ? "Stop dictation" : speech.state === "stopping" ? "Finishing…" : "Use microphone";
  const status = support === "checking" ? "Checking voice input…"
    : support === "insecure" ? "Voice input needs HTTPS or localhost. You can still type your explanation."
    : support === "unsupported" ? "Voice input is unavailable in this browser. You can still type your explanation."
    : speech.state === "starting" ? "Allow microphone access in your browser to begin."
    : speech.state === "listening" ? "Listening. Speak clearly, then stop when you are ready."
    : speech.state === "stopping" ? "Finishing the last words…"
    : speech.limited ? "Dictation reached its limit. Add this text, then dictate another part."
    : speech.finalText ? "Review your words before adding them to your explanation."
    : remaining === 0 ? "Your explanation is full. Shorten it to make room for dictation."
    : "Dictate for up to one minute at a time.";

  return (
    <div className="voice-input" role="group" aria-label="Voice input">
      <div className="voice-toolbar">
        <button type="button" className={`secondary voice-toggle${active ? " is-listening" : ""}`} onClick={toggle}
          disabled={disabled || support !== "available" || speech.state === "stopping" || (!active && (remaining === 0 || Boolean(speech.finalText)))}
          aria-pressed={active} aria-describedby={`${id}-status ${id}-privacy`}>
          <MicrophoneIcon stop={active} />{label}
        </button>
        <div className="voice-language">
          <label htmlFor={`${id}-language`}>Spoken language</label>
          <select id={`${id}-language`} value={language} onChange={(event) => setLanguage(event.target.value)} disabled={disabled || active || support !== "available"}>
            <option value="ru-RU" lang="ru">Русский</option>
            <option value="en-US" lang="en">English</option>
          </select>
        </div>
      </div>
      <p id={`${id}-status`} className="voice-status" role="status">{status}</p>
      {speech.error && <p className="notice error" role="alert">{speech.error.message}</p>}
      {(speech.finalText || speech.interimText) && <div className="voice-preview" role="region" aria-label="Dictated text">
        <strong>Dictated text</strong>
        <p className="voice-transcript">{speech.finalText}{speech.finalText && speech.interimText ? " " : ""}<span>{speech.interimText}</span></p>
        {!active && <>
          {!fits && <p className="voice-status">Shorten your explanation to make room for this text.</p>}
          <div className="voice-preview-actions">
            <button type="button" onClick={useText} disabled={disabled || !speech.finalText || !fits}>Add to explanation</button>
            <button type="button" className="secondary" onClick={discard}>Discard dictation</button>
          </div>
        </>}
      </div>}
      <p id={`${id}-privacy`} className="voice-privacy">Your browser may process audio online. TeachAPP saves only the text you choose to send.</p>
    </div>
  );
}
