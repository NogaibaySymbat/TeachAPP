import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { countCharacters, DEFAULT_MONTHLY_CHARACTER_CAP, readTtsConfig, usageMonth } from "../src/server/tts/config";

describe("text-to-speech config", () => {
  it("is disabled without an API key", () => {
    expect(readTtsConfig({}).apiKey).toBeNull();
    expect(readTtsConfig({ GOOGLE_TTS_API_KEY: "  " }).apiKey).toBeNull();
  });

  it("defaults the cap below the free tier and never raises it above", () => {
    expect(readTtsConfig({}).monthlyCharacterCap).toBe(DEFAULT_MONTHLY_CHARACTER_CAP);
    expect(readTtsConfig({ TTS_MONTHLY_CHARACTER_CAP: "5000000" }).monthlyCharacterCap).toBe(1_000_000);
    expect(readTtsConfig({ TTS_MONTHLY_CHARACTER_CAP: "1000" }).monthlyCharacterCap).toBe(1000);
    expect(readTtsConfig({ TTS_MONTHLY_CHARACTER_CAP: "0" }).monthlyCharacterCap).toBe(0);
    expect(readTtsConfig({ TTS_MONTHLY_CHARACTER_CAP: "lots" }).monthlyCharacterCap).toBe(DEFAULT_MONTHLY_CHARACTER_CAP);
    expect(readTtsConfig({ TTS_MONTHLY_CHARACTER_CAP: "-1" }).monthlyCharacterCap).toBe(DEFAULT_MONTHLY_CHARACTER_CAP);
  });

  it("accepts only plain voice names", () => {
    expect(readTtsConfig({ GOOGLE_TTS_VOICE: "Puck" }).voice).toBe("Puck");
    expect(readTtsConfig({ GOOGLE_TTS_VOICE: "en-US-Puck/../x" }).voice).toBe("Leda");
  });

  it("counts characters the way the provider bills them", () => {
    expect(countCharacters("Hi there\n")).toBe(9);
    expect(countCharacters("Привет")).toBe(6);
    expect(countCharacters("🙂ok")).toBe(3);
  });

  it("uses UTC calendar months", () => {
    expect(usageMonth(new Date("2026-11-30T23:30:00Z"))).toBe("2026-11");
    expect(usageMonth(new Date("2026-12-01T00:00:00Z"))).toBe("2026-12");
  });
});
