"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiRequestError, apiAudio } from "@/lib/api";
import {
  isSpeechSynthesisSupported, readVoicePreference, saveVoicePreference, speak, stopSpeaking,
} from "@/lib/speech-synthesis";

// Cloud errors after which this page stops asking the server and uses the browser voice.
const CLOUD_OFF_CODES = new Set(["TTS_NOT_CONFIGURED", "TTS_LIMIT_REACHED"]);

export interface StudentVoice {
  supported: boolean;
  enabled: boolean;
  speakingId: string | null;
  loadingId: string | null;
  toggle(): void;
  // Speaks only when the user has turned the student's voice on.
  announce(messageId: string, text: string): void;
  // Speaks on an explicit click, regardless of the setting.
  play(messageId: string, text: string): void;
  stop(): void;
}

export function useStudentVoice(sessionId: string): StudentVoice {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const audioUrls = useRef(new Map<string, string>());
  const currentAudio = useRef<HTMLAudioElement | null>(null);
  const pending = useRef<AbortController | null>(null);
  const cloudOff = useRef(false);

  useEffect(() => {
    // Audio playback works in every modern browser; the browser voice is the fallback.
    const available = typeof window !== "undefined" && ("Audio" in window || isSpeechSynthesisSupported());
    // Browser capabilities are only known after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(available);
    setEnabled(available && readVoicePreference());
    if (isSpeechSynthesisSupported()) window.speechSynthesis.getVoices();
    const urls = audioUrls.current;
    return () => {
      pending.current?.abort();
      currentAudio.current?.pause();
      stopSpeaking();
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

  const stop = useCallback(() => {
    pending.current?.abort();
    pending.current = null;
    currentAudio.current?.pause();
    currentAudio.current = null;
    stopSpeaking();
    setLoadingId(null);
    setSpeakingId(null);
  }, []);

  const finish = useCallback((messageId: string) => {
    setSpeakingId((current) => (current === messageId ? null : current));
  }, []);

  const speakWithBrowser = useCallback((messageId: string, text: string) => {
    if (!isSpeechSynthesisSupported()) { finish(messageId); return; }
    setSpeakingId(messageId);
    speak(text, { onEnd: () => finish(messageId) });
  }, [finish]);

  const playUrl = useCallback((messageId: string, url: string, text: string) => {
    const audio = new Audio(url);
    currentAudio.current = audio;
    setSpeakingId(messageId);
    audio.onended = () => finish(messageId);
    audio.onerror = () => speakWithBrowser(messageId, text);
    // Some browsers block playback that does not follow a click; the Listen button still works.
    audio.play().catch(() => finish(messageId));
  }, [finish, speakWithBrowser]);

  const play = useCallback((messageId: string, text: string) => {
    stop();
    const cached = audioUrls.current.get(messageId);
    if (cached) { playUrl(messageId, cached, text); return; }
    if (cloudOff.current) { speakWithBrowser(messageId, text); return; }
    const controller = new AbortController();
    pending.current = controller;
    setLoadingId(messageId);
    apiAudio(`/api/sessions/${sessionId}/messages/${messageId}/speech`, controller.signal)
      .then((blob) => {
        if (controller.signal.aborted) return;
        const url = URL.createObjectURL(blob);
        audioUrls.current.set(messageId, url);
        playUrl(messageId, url, text);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof ApiRequestError && CLOUD_OFF_CODES.has(error.code)) cloudOff.current = true;
        speakWithBrowser(messageId, text);
      })
      .finally(() => {
        if (pending.current === controller) pending.current = null;
        setLoadingId((current) => (current === messageId ? null : current));
      });
  }, [sessionId, stop, playUrl, speakWithBrowser]);

  const announce = useCallback((messageId: string, text: string) => {
    if (enabled) play(messageId, text);
  }, [enabled, play]);

  const toggle = useCallback(() => {
    setEnabled((current) => {
      const next = !current;
      saveVoicePreference(next);
      return next;
    });
    if (enabled) stop();
  }, [enabled, stop]);

  return { supported, enabled, speakingId, loadingId, toggle, announce, play, stop };
}

export function VoiceOutputToggle({ voice }: { voice: StudentVoice }) {
  if (!voice.supported) return null;
  return (
    <button type="button" className="secondary" aria-pressed={voice.enabled} onClick={voice.toggle}>
      {voice.enabled ? "Student voice: on" : "Student voice: off"}
    </button>
  );
}

export function SpeakMessageButton({ voice, messageId, text }: { voice: StudentVoice; messageId: string; text: string }) {
  if (!voice.supported) return null;
  const loading = voice.loadingId === messageId;
  const active = loading || voice.speakingId === messageId;
  return (
    <button type="button" className="secondary" onClick={() => (active ? voice.stop() : voice.play(messageId, text))}>
      {loading ? "Loading voice…" : active ? "Stop" : "Listen"}
    </button>
  );
}
