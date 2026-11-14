import { describe, expect, it } from "vitest";
import { detectSpeechLanguage, pickVoice, splitIntoSentences } from "../src/lib/speech-synthesis";

const voice = (name: string, lang: string, voiceURI = "") => ({ name, lang, voiceURI }) as SpeechSynthesisVoice;

describe("speech synthesis helpers", () => {
  it("detects the dominant script", () => {
    expect(detectSpeechLanguage("Who are the stakeholders here?")).toBe("en-US");
    expect(detectSpeechLanguage("Кто такие стейкхолдеры в проекте?")).toBe("ru-RU");
    expect(detectSpeechLanguage("")).toBe("en-US");
  });

  it("splits a reply into sentences and keeps all text", () => {
    expect(splitIntoSentences("So they matter. Why? Give me an example!")).toEqual([
      "So they matter.", "Why?", "Give me an example!",
    ]);
    expect(splitIntoSentences("no punctuation")).toEqual(["no punctuation"]);
  });

  it("prefers a known high-quality voice in the right language", () => {
    const voices = [voice("Fred", "en-US"), voice("Samantha", "en-US"), voice("Milena", "ru-RU")];
    expect(pickVoice(voices, "en-US")?.name).toBe("Samantha");
    expect(pickVoice(voices, "ru-RU")?.name).toBe("Milena");
  });

  it("falls back to any voice of the language, or null", () => {
    expect(pickVoice([voice("Daniel", "en-GB")], "en-US")?.name).toBe("Daniel");
    expect(pickVoice([voice("Daniel", "en-GB")], "ru-RU")).toBeNull();
  });

  it("prefers downloaded macOS voices and Edge neural voices", () => {
    const mac = [voice("Albert", "en-US"), voice("Samantha", "en-US"), voice("Evan (Enhanced)", "en-US"), voice("Ava (Premium)", "en-US")];
    expect(pickVoice(mac, "en-US")?.name).toBe("Ava (Premium)");
    expect(pickVoice(mac.slice(0, 3), "en-US")?.name).toBe("Evan (Enhanced)");
    const byUri = [voice("Samantha", "en-US"), voice("Ava", "en-US", "com.apple.voice.premium.en-US.Ava")];
    expect(pickVoice(byUri, "en-US")?.name).toBe("Ava");
    const edge = [voice("Microsoft David - English (United States)", "en-US"), voice("Microsoft Ava Online (Natural) - English (United States)", "en-US")];
    expect(pickVoice(edge, "en-US")?.name).toContain("Natural");
  });

  it("never picks novelty voices and prefers the US accent on ties", () => {
    expect(pickVoice([voice("Albert", "en-US"), voice("Zarvox", "en-US"), voice("Fred", "en-US")], "en-US")?.name).toBe("Fred");
    expect(pickVoice([voice("Bubbles", "en-US")], "en-US")).toBeNull();
    const ties = [voice("Microsoft Libby Online (Natural)", "en-GB"), voice("Microsoft Ava Online (Natural)", "en-US")];
    expect(pickVoice(ties, "en-US")?.name).toContain("Ava");
  });
});
