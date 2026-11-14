import "server-only";
import { ServiceError } from "@/server/errors";
import { PROVIDER_TIMEOUT_MS } from "./config";

const ENDPOINT = "https://texttospeech.googleapis.com/v1/text:synthesize";

export interface SynthesisRequest {
  apiKey: string;
  text: string;
  languageCode: "en-US" | "ru-RU";
  voice: string;
}

export function buildSynthesisBody({ text, languageCode, voice }: Omit<SynthesisRequest, "apiKey">) {
  return {
    input: { text },
    voice: { languageCode, name: `${languageCode}-Chirp3-HD-${voice}` },
    audioConfig: { audioEncoding: "MP3" },
  };
}

// One request, no automatic retries: a retry would spend characters again.
export async function synthesizeSpeech(request: SynthesisRequest, fetcher: typeof fetch = fetch): Promise<Uint8Array> {
  let response: Response;
  try {
    response = await fetcher(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": request.apiKey },
      body: JSON.stringify(buildSynthesisBody(request)),
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    });
  } catch {
    throw new ServiceError(502, "TTS_PROVIDER_UNAVAILABLE", "The student's voice is unavailable right now.");
  }
  if (!response.ok) {
    // Never log the request: the API key travels in its headers.
    console.error("Text-to-speech request failed.", { status: response.status });
    throw new ServiceError(502, "TTS_PROVIDER_FAILED", "The student's voice is unavailable right now.");
  }
  const data = await response.json().catch(() => null) as { audioContent?: unknown } | null;
  if (typeof data?.audioContent !== "string" || !data.audioContent) {
    throw new ServiceError(502, "TTS_PROVIDER_FAILED", "The student's voice is unavailable right now.");
  }
  return new Uint8Array(Buffer.from(data.audioContent, "base64"));
}
