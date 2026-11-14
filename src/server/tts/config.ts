import "server-only";

// Google Cloud Text-to-Speech, Chirp 3: HD voices.
// Pricing checked 2026-11-15: 0-1,000,000 characters per month free, then
// US$30 per 1M characters, billed automatically with no provider-side cap.
// https://cloud.google.com/text-to-speech/pricing
export const TTS_PROVIDER = "google-chirp3-hd";
export const FREE_TIER_CHARACTERS = 1_000_000;
// Stay below the free tier: Google bills by calendar month in its own time zone,
// while this ledger uses UTC months, so keep a safety margin.
export const DEFAULT_MONTHLY_CHARACTER_CAP = 900_000;
export const MAX_SYNTHESES_PER_MESSAGE = 3;
export const MAX_SPEECH_CHARACTERS = 2_000;
export const PROVIDER_TIMEOUT_MS = 15_000;
const DEFAULT_VOICE = "Leda";

export interface TtsConfig {
  apiKey: string | null;
  monthlyCharacterCap: number;
  voice: string;
}

export function readTtsConfig(env: Record<string, string | undefined> = process.env): TtsConfig {
  const apiKey = env.GOOGLE_TTS_API_KEY?.trim() || null;
  // The cap can be lowered but never raised above the free tier.
  const requested = Number(env.TTS_MONTHLY_CHARACTER_CAP);
  const monthlyCharacterCap = Number.isSafeInteger(requested) && requested >= 0
    ? Math.min(requested, FREE_TIER_CHARACTERS)
    : DEFAULT_MONTHLY_CHARACTER_CAP;
  const voice = /^[A-Za-z]{2,32}$/.test(env.GOOGLE_TTS_VOICE ?? "") ? env.GOOGLE_TTS_VOICE! : DEFAULT_VOICE;
  return { apiKey, monthlyCharacterCap, voice };
}

// Google counts every character, including spaces and newlines.
export function countCharacters(text: string): number {
  return [...text].length;
}

export function usageMonth(date: Date = new Date()): string {
  return date.toISOString().slice(0, 7);
}
