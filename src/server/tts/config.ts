import "server-only";

// Cloud voices for the AI student. Deepgram is preferred when both keys exist.
//
// Deepgram Aura-2 (checked 2026-11-15): US$0.030 per 1,000 characters, paid from
// a US$200 sign-up credit that needs no card, so usage cannot reach a card.
// English only here; other languages use the browser voice.
// https://deepgram.com/pricing
//
// Google Cloud Text-to-Speech, Chirp 3: HD (checked 2026-11-15): 0-1,000,000
// characters per month free, then US$30 per 1M, billed automatically with no
// provider-side cap. https://cloud.google.com/text-to-speech/pricing
export type TtsProviderId = "deepgram-aura-2" | "google-chirp3-hd";

interface ProviderLimits { defaultCap: number; maxCap: number }
export const PROVIDER_LIMITS: Record<TtsProviderId, ProviderLimits> = {
  // 1,000,000 characters is about US$30 of the US$200 credit per month.
  "deepgram-aura-2": { defaultCap: 1_000_000, maxCap: 3_000_000 },
  // Stay below Google's free tier: Google bills by calendar month in its own
  // time zone, while this ledger uses UTC months, so keep a safety margin.
  "google-chirp3-hd": { defaultCap: 900_000, maxCap: 1_000_000 },
};
export const MAX_SYNTHESES_PER_MESSAGE = 3;
export const MAX_SPEECH_CHARACTERS = 2_000;
export const PROVIDER_TIMEOUT_MS = 15_000;

export interface TtsConfig {
  provider: TtsProviderId | null;
  apiKey: string | null;
  monthlyCharacterCap: number;
  voice: string;
}

type Env = Record<string, string | undefined>;

function readCap(env: Env, provider: TtsProviderId): number {
  const { defaultCap, maxCap } = PROVIDER_LIMITS[provider];
  const requested = Number(env.TTS_MONTHLY_CHARACTER_CAP);
  // The cap can be lowered but never raised above the provider's ceiling.
  return Number.isSafeInteger(requested) && requested >= 0 && env.TTS_MONTHLY_CHARACTER_CAP?.trim()
    ? Math.min(requested, maxCap)
    : defaultCap;
}

function readVoice(value: string | undefined, pattern: RegExp, fallback: string): string {
  return value && pattern.test(value) ? value : fallback;
}

export function readTtsConfig(env: Env = process.env): TtsConfig {
  const deepgramKey = env.DEEPGRAM_API_KEY?.trim();
  if (deepgramKey) {
    return {
      provider: "deepgram-aura-2",
      apiKey: deepgramKey,
      monthlyCharacterCap: readCap(env, "deepgram-aura-2"),
      voice: readVoice(env.DEEPGRAM_TTS_VOICE, /^[a-z]{2,32}$/, "thalia"),
    };
  }
  const googleKey = env.GOOGLE_TTS_API_KEY?.trim();
  if (googleKey) {
    return {
      provider: "google-chirp3-hd",
      apiKey: googleKey,
      monthlyCharacterCap: readCap(env, "google-chirp3-hd"),
      voice: readVoice(env.GOOGLE_TTS_VOICE, /^[A-Za-z]{2,32}$/, "Leda"),
    };
  }
  return { provider: null, apiKey: null, monthlyCharacterCap: 0, voice: "" };
}

// Providers count every character, including spaces and newlines.
export function countCharacters(text: string): number {
  return [...text].length;
}

export function usageMonth(date: Date = new Date()): string {
  return date.toISOString().slice(0, 7);
}
