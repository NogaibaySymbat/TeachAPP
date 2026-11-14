import { describe, expect, it } from "vitest";
import { detectSpeechLanguage, pickVoice, splitIntoSentences } from "../src/lib/speech-synthesis";

const voice = (name: string, lang: string) => ({ name, lang }) as SpeechSynthesisVoice;

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
});
