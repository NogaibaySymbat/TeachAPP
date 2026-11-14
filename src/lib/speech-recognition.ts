// Browser speech services may process audio remotely. This adapter never records
// audio or contacts TeachAPP/OpenAI; only the browser's recognizer receives it.
export interface SpeechResult {
  readonly isFinal: boolean;
  readonly length: number;
  readonly [index: number]: { readonly transcript: string };
}

export interface BrowserSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onresult: ((event: { results: ArrayLike<SpeechResult> }) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

export type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;
export interface SpeechEnvironment {
  isSecureContext?: boolean;
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

export type SpeechErrorCode =
  | "unsupported" | "insecure" | "not-allowed" | "service-not-allowed"
  | "audio-capture" | "network" | "language-not-supported" | "no-speech"
  | "aborted" | "start-timeout" | "stop-timeout" | "unavailable";
export interface SpeechError { code: SpeechErrorCode; message: string }
export interface SpeechSnapshot {
  state: "idle" | "starting" | "listening" | "stopping";
  finalText: string;
  interimText: string;
  error: SpeechError | null;
  limited: boolean;
}

const errorMessages: Record<SpeechErrorCode, string> = {
  unsupported: "Voice input is not supported by this browser. You can keep typing.",
  insecure: "Voice input needs HTTPS or localhost. You can keep typing.",
  "not-allowed": "Microphone access was blocked. Allow it in your browser's site settings, then try again.",
  "service-not-allowed": "Your browser has disabled speech recognition. You can keep typing or try another browser.",
  "audio-capture": "No microphone is available. Check that one is connected and allowed by your device.",
  network: "The browser's speech service could not connect. Check your connection and try again.",
  "language-not-supported": "The speech service does not support this language. Choose another language or type your explanation.",
  "no-speech": "No speech was heard. Try again and speak clearly into your microphone.",
  aborted: "Voice input stopped. You can review the text already recognized or try again.",
  "start-timeout": "The microphone did not start. Check the browser's microphone permission and try again.",
  "stop-timeout": "Speech recognition took too long to finish. Review the text already recognized before using it.",
  unavailable: "Voice input could not start. You can keep typing or try again.",
};

function speechError(code: string): SpeechError {
  const known = Object.hasOwn(errorMessages, code) ? code as SpeechErrorCode : "unavailable";
  return { code: known, message: errorMessages[known] };
}

export type SpeechSupport =
  | { available: true; Recognition: SpeechRecognitionConstructor }
  | { available: false; code: "unsupported" | "insecure"; message: string };

export function getSpeechSupport(scope?: SpeechEnvironment): SpeechSupport {
  const environment = scope ?? (typeof window === "undefined" ? undefined : window as unknown as SpeechEnvironment);
  if (!environment) return { available: false, code: "unsupported", message: errorMessages.unsupported };
  if (environment.isSecureContext !== true) return { available: false, code: "insecure", message: errorMessages.insecure };
  const Recognition = environment.SpeechRecognition ?? environment.webkitSpeechRecognition;
  return typeof Recognition === "function"
    ? { available: true, Recognition }
    : { available: false, code: "unsupported", message: errorMessages.unsupported };
}

// The composer uses UTF-16 character limits. Avoid leaving half a surrogate pair
// when truncating a transcript to the space left in its draft.
export function truncateSpeechText(text: string, maximum: number): string {
  const limit = Number.isFinite(maximum) ? Math.max(0, Math.floor(maximum)) : 0;
  if (text.length <= limit) return text;
  const previous = text.charCodeAt(limit - 1);
  const next = text.charCodeAt(limit);
  const splitsPair = previous >= 0xd800 && previous <= 0xdbff && next >= 0xdc00 && next <= 0xdfff;
  return text.slice(0, splitsPair ? limit - 1 : limit);
}

export interface SpeechController {
  start(lang: string, maxCharacters?: number): void;
  stop(): void;
  cancel(): void;
  clear(): void;
  dispose(): void;
}

export function createSpeechController({
  Recognition, onChange, maxCharacters = 4000,
}: {
  Recognition: SpeechRecognitionConstructor;
  onChange: (snapshot: SpeechSnapshot) => void;
  maxCharacters?: number;
}): SpeechController {
  let snapshot: SpeechSnapshot = { state: "idle", finalText: "", interimText: "", error: null, limited: false };
  let recognition: BrowserSpeechRecognition | null = null;
  let disposed = false;
  let generation = 0;
  let startTimer: ReturnType<typeof setTimeout> | undefined;
  let durationTimer: ReturnType<typeof setTimeout> | undefined;
  let stopTimer: ReturnType<typeof setTimeout> | undefined;

  function update(changes: Partial<SpeechSnapshot>) {
    snapshot = { ...snapshot, ...changes };
    if (!disposed) onChange({ ...snapshot });
  }

  function clearTimers() {
    clearTimeout(startTimer);
    clearTimeout(durationTimer);
    clearTimeout(stopTimer);
    startTimer = durationTimer = stopTimer = undefined;
  }

  function detach(abort: boolean) {
    const previous = recognition;
    recognition = null;
    generation += 1;
    clearTimers();
    if (!previous) return;
    previous.onstart = previous.onend = previous.onerror = previous.onresult = null;
    if (abort) {
      try { previous.abort(); } catch { /* The browser may already have ended capture. */ }
    }
  }

  function fail(code: string) {
    detach(true);
    update({ state: "idle", interimText: "", error: speechError(code) });
  }

  function stop() {
    if (disposed || !recognition || snapshot.state === "stopping") return;
    if (snapshot.state === "starting") {
      detach(true);
      update({ state: "idle", interimText: "" });
      return;
    }
    clearTimeout(durationTimer);
    update({ state: "stopping" });
    const current = recognition;
    const token = generation;
    stopTimer = setTimeout(() => {
      if (token === generation) fail("stop-timeout");
    }, 5000);
    try { current.stop(); } catch { fail("unavailable"); }
  }

  function start(lang: string, remaining = maxCharacters) {
    if (disposed || recognition) return;
    const limit = Number.isFinite(remaining) ? Math.max(0, Math.min(4000, Math.floor(remaining))) : 0;
    update({ state: "idle", finalText: "", interimText: "", error: null, limited: limit === 0 });
    if (!limit) return;
    let current: BrowserSpeechRecognition;
    try { current = new Recognition(); } catch { fail("unavailable"); return; }
    recognition = current;
    const token = ++generation;
    const isCurrent = () => !disposed && recognition === current && token === generation;
    current.lang = lang;
    current.continuous = true;
    current.interimResults = true;
    current.maxAlternatives = 1;
    current.onstart = () => {
      if (!isCurrent() || snapshot.state !== "starting") return;
      clearTimeout(startTimer);
      update({ state: "listening" });
      durationTimer = setTimeout(() => {
        if (!isCurrent()) return;
        update({ limited: true });
        stop();
      }, 60_000);
    };
    current.onresult = (event) => {
      if (!isCurrent() || snapshot.state === "starting") return;
      // The results list contains all final results and the current mutable
      // interim results for this run. Rebuilding avoids duplicates on updates.
      const final: string[] = [];
      const interim: string[] = [];
      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        const text = result?.[0]?.transcript?.trim();
        if (text) (result.isFinal ? final : interim).push(text);
      }
      const finalText = final.join(" ");
      const limitedFinal = truncateSpeechText(finalText, limit);
      const interimLimit = Math.max(0, limit - limitedFinal.length - (limitedFinal ? 1 : 0));
      update({ finalText: limitedFinal, interimText: truncateSpeechText(interim.join(" "), interimLimit) });
      // Only a final transcript can consume the limit: interim hypotheses may
      // shrink later and must not prematurely stop a recording.
      if (finalText.length >= limit) {
        update({ limited: true });
        stop();
      }
    };
    current.onerror = (event) => { if (isCurrent()) fail(event.error); };
    current.onend = () => {
      if (!isCurrent()) return;
      detach(false);
      update({ state: "idle", interimText: "", error: snapshot.finalText ? null : speechError("no-speech") });
    };
    update({ state: "starting" });
    startTimer = setTimeout(() => { if (isCurrent()) fail("start-timeout"); }, 15_000);
    try { current.start(); }
    catch (error) {
      const name = error instanceof Error ? error.name : "";
      fail(name === "NotAllowedError" || name === "SecurityError" ? "not-allowed" : "unavailable");
    }
  }

  function cancel() {
    if (disposed) return;
    detach(true);
    update({ state: "idle", interimText: "" });
  }

  return {
    start, stop, cancel,
    clear() {
      if (disposed) return;
      detach(true);
      update({ state: "idle", finalText: "", interimText: "", error: null, limited: false });
    },
    dispose() { disposed = true; detach(true); },
  };
}
