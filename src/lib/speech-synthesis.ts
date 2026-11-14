// Browser text-to-speech for the AI student's replies.
// Uses the built-in Web Speech API: no provider, no API key, no cost.
// Voice quality depends on the browser and operating system.

const PREFERENCE_KEY = "student_voice_enabled";

// Novelty voices that ship with macOS and sound like effects, not people.
const NOVELTY_VOICES = /^(Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Deranged|Good News|Hysterical|Jester|Organ|Pipe Organ|Superstar|Trinoids|Whisper|Wobble|Zarvox)\b/i;

// Higher score = more natural. Downloaded macOS voices are marked Premium or
// Enhanced; Edge's neural voices say Natural; Chrome ships Google voices.
function voiceQuality(voice: SpeechSynthesisVoice): number {
  const label = `${voice.name} ${voice.voiceURI ?? ""}`;
  if (/natural|neural/i.test(label)) return 4;
  if (/premium/i.test(label)) return 4;
  if (/enhanced|siri/i.test(label)) return 3;
  if (/^google/i.test(voice.name)) return 2;
  if (/^(Samantha|Milena|Alex|Daniel|Karen|Moira|Tessa)\b/.test(voice.name)) return 1;
  return 0;
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

export function readVoicePreference(): boolean {
  try { return window.localStorage.getItem(PREFERENCE_KEY) === "true"; }
  catch { return false; }
}

export function saveVoicePreference(enabled: boolean): void {
  try { window.localStorage.setItem(PREFERENCE_KEY, String(enabled)); }
  catch { /* Storage unavailable: the preference lasts for this page only. */ }
}

export function detectSpeechLanguage(text: string): "ru-RU" | "en-US" {
  const cyrillic = text.match(/[Ѐ-ӿ]/g)?.length ?? 0;
  const latin = text.match(/[A-Za-z]/g)?.length ?? 0;
  return cyrillic > latin ? "ru-RU" : "en-US";
}

export function pickVoice(voices: readonly SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | null {
  const prefix = lang.slice(0, 2).toLowerCase();
  const exact = lang.toLowerCase();
  let best: SpeechSynthesisVoice | null = null;
  let bestScore = -Infinity;
  for (const voice of voices) {
    const voiceLang = voice.lang.toLowerCase().replace("_", "-");
    if (!voiceLang.startsWith(prefix) || NOVELTY_VOICES.test(voice.name)) continue;
    // Quality matters most; the exact accent (en-US for a US audience) breaks ties.
    const score = voiceQuality(voice) * 2 + (voiceLang === exact ? 1 : 0);
    if (score > bestScore) { best = voice; bestScore = score; }
  }
  return best;
}

// Long utterances can be cut off by some browsers, so speak sentence by sentence.
export function splitIntoSentences(text: string): string[] {
  return (text.match(/[^.!?…]+[.!?…]*\s*/g) ?? [text]).map((part) => part.trim()).filter(Boolean);
}

export function stopSpeaking(): void {
  if (isSpeechSynthesisSupported()) window.speechSynthesis.cancel();
}

export function speak(text: string, handlers: { onEnd?: () => void } = {}): void {
  if (!isSpeechSynthesisSupported() || !text.trim()) { handlers.onEnd?.(); return; }
  const synthesis = window.speechSynthesis;
  synthesis.cancel();
  const lang = detectSpeechLanguage(text);
  const voice = pickVoice(synthesis.getVoices(), lang);
  const sentences = splitIntoSentences(text);
  sentences.forEach((sentence, index) => {
    const utterance = new SpeechSynthesisUtterance(sentence);
    utterance.lang = voice?.lang ?? lang;
    if (voice) utterance.voice = voice;
    if (index === sentences.length - 1) {
      utterance.onend = () => handlers.onEnd?.();
      utterance.onerror = () => handlers.onEnd?.();
    }
    synthesis.speak(utterance);
  });
}
