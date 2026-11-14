// Browser text-to-speech for the AI student's replies.
// Uses the built-in Web Speech API: no provider, no API key, no cost.
// Voice quality depends on the browser and operating system.

const PREFERENCE_KEY = "student_voice_enabled";

// Higher-quality voices to prefer when the browser offers them.
const PREFERRED_VOICES = [
  "Natural", "Google US English", "Google UK English Female", "Samantha", "Google русский", "Milena",
];

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
  const matching = voices.filter((voice) => voice.lang.toLowerCase().startsWith(prefix));
  if (matching.length === 0) return null;
  for (const name of PREFERRED_VOICES) {
    const preferred = matching.find((voice) => voice.name.includes(name));
    if (preferred) return preferred;
  }
  return matching.find((voice) => voice.lang.toLowerCase() === lang.toLowerCase()) ?? matching[0];
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
