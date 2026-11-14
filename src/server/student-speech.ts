import "server-only";
import { detectSpeechLanguage } from "@/lib/speech-synthesis";
import { ServiceError } from "./errors";
import { findStudentMessageText, reserveTtsCharacters } from "./repositories/tts-usage";
import { countCharacters, MAX_SPEECH_CHARACTERS, readTtsConfig } from "./tts/config";
import { synthesizeWithDeepgram } from "./tts/deepgram";
import { synthesizeSpeech } from "./tts/google";

// Reads a saved student reply aloud. Only stored replies can be synthesized,
// never arbitrary text, so the route cannot be used as a free speech service.
export async function speakStudentMessage(userId: string, sessionId: string, messageId: string): Promise<Uint8Array> {
  const config = readTtsConfig();
  if (!config.provider || !config.apiKey) {
    throw new ServiceError(501, "TTS_NOT_CONFIGURED", "The student's cloud voice is not set up.");
  }
  const text = (await findStudentMessageText(userId, sessionId, messageId)).trim();
  const characters = countCharacters(text);
  if (characters > MAX_SPEECH_CHARACTERS) {
    throw new ServiceError(413, "TTS_TEXT_TOO_LONG", "This reply is too long to read aloud.");
  }
  const languageCode = detectSpeechLanguage(text);
  // Deepgram voices are English here; the browser reads other languages.
  if (config.provider === "deepgram-aura-2" && languageCode !== "en-US") {
    throw new ServiceError(422, "TTS_LANGUAGE_UNSUPPORTED", "The cloud voice does not speak this language.");
  }
  await reserveTtsCharacters({
    provider: config.provider, messageId, characters, monthlyCharacterCap: config.monthlyCharacterCap,
  });
  return config.provider === "deepgram-aura-2"
    ? synthesizeWithDeepgram({ apiKey: config.apiKey, text, voice: config.voice })
    : synthesizeSpeech({ apiKey: config.apiKey, text, languageCode, voice: config.voice });
}
