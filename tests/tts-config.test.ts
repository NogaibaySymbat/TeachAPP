import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { countCharacters, readTtsConfig, usageMonth } from "../src/server/tts/config";

describe("text-to-speech config", () => {
  it("is disabled without any key", () => {
    expect(readTtsConfig({}).provider).toBeNull();
    expect(readTtsConfig({ GOOGLE_TTS_API_KEY: "  ", DEEPGRAM_API_KEY: "" }).provider).toBeNull();
  });

  it("prefers Deepgram when both keys are set", () => {
    const config = readTtsConfig({ GOOGLE_TTS_API_KEY: "g", DEEPGRAM_API_KEY: "d" });
    expect(config).toMatchObject({ provider: "deepgram-aura-2", apiKey: "d", voice: "thalia", monthlyCharacterCap: 1_000_000 });
    expect(readTtsConfig({ GOOGLE_TTS_API_KEY: "g" })).toMatchObject({ provider: "google-chirp3-hd", voice: "Leda", monthlyCharacterCap: 900_000 });
  });

  it("lets the cap be lowered but never raised above the provider ceiling", () => {
    expect(readTtsConfig({ GOOGLE_TTS_API_KEY: "g", TTS_MONTHLY_CHARACTER_CAP: "5000000" }).monthlyCharacterCap).toBe(1_000_000);
    expect(readTtsConfig({ DEEPGRAM_API_KEY: "d", TTS_MONTHLY_CHARACTER_CAP: "99000000" }).monthlyCharacterCap).toBe(3_000_000);
    expect(readTtsConfig({ DEEPGRAM_API_KEY: "d", TTS_MONTHLY_CHARACTER_CAP: "1000" }).monthlyCharacterCap).toBe(1000);
    expect(readTtsConfig({ DEEPGRAM_API_KEY: "d", TTS_MONTHLY_CHARACTER_CAP: "0" }).monthlyCharacterCap).toBe(0);
    expect(readTtsConfig({ DEEPGRAM_API_KEY: "d", TTS_MONTHLY_CHARACTER_CAP: "lots" }).monthlyCharacterCap).toBe(1_000_000);
    expect(readTtsConfig({ DEEPGRAM_API_KEY: "d", TTS_MONTHLY_CHARACTER_CAP: "-1" }).monthlyCharacterCap).toBe(1_000_000);
    expect(readTtsConfig({ DEEPGRAM_API_KEY: "d", TTS_MONTHLY_CHARACTER_CAP: "" }).monthlyCharacterCap).toBe(1_000_000);
  });

  it("accepts only plain voice names", () => {
    expect(readTtsConfig({ DEEPGRAM_API_KEY: "d", DEEPGRAM_TTS_VOICE: "apollo" }).voice).toBe("apollo");
    expect(readTtsConfig({ DEEPGRAM_API_KEY: "d", DEEPGRAM_TTS_VOICE: "x&model=other" }).voice).toBe("thalia");
    expect(readTtsConfig({ GOOGLE_TTS_API_KEY: "g", GOOGLE_TTS_VOICE: "Puck" }).voice).toBe("Puck");
    expect(readTtsConfig({ GOOGLE_TTS_API_KEY: "g", GOOGLE_TTS_VOICE: "en-US-Puck/../x" }).voice).toBe("Leda");
  });

  it("counts characters the way providers bill them", () => {
    expect(countCharacters("Hi there\n")).toBe(9);
    expect(countCharacters("Привет")).toBe(6);
    expect(countCharacters("🙂ok")).toBe(3);
  });

  it("uses UTC calendar months", () => {
    expect(usageMonth(new Date("2026-11-30T23:30:00Z"))).toBe("2026-11");
    expect(usageMonth(new Date("2026-12-01T00:00:00Z"))).toBe("2026-12");
  });
});
