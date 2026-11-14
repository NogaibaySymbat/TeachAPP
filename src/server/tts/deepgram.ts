import "server-only";
import { ServiceError } from "@/server/errors";
import { PROVIDER_TIMEOUT_MS } from "./config";

const ENDPOINT = "https://api.deepgram.com/v1/speak";

export interface DeepgramRequest {
  apiKey: string;
  text: string;
  voice: string;
}

export function deepgramUrl(voice: string): string {
  const url = new URL(ENDPOINT);
  url.searchParams.set("model", `aura-2-${voice}-en`);
  url.searchParams.set("encoding", "mp3");
  return url.toString();
}

// One request, no automatic retries: a retry would spend credit again.
export async function synthesizeWithDeepgram(request: DeepgramRequest, fetcher: typeof fetch = fetch): Promise<Uint8Array> {
  let response: Response;
  try {
    response = await fetcher(deepgramUrl(request.voice), {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Token ${request.apiKey}` },
      body: JSON.stringify({ text: request.text }),
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    });
  } catch {
    throw new ServiceError(502, "TTS_PROVIDER_UNAVAILABLE", "The student's voice is unavailable right now.");
  }
  if (!response.ok) {
    // Never log the request: the API key travels in its headers.
    console.error("Text-to-speech request failed.", { provider: "deepgram", status: response.status });
    throw new ServiceError(502, "TTS_PROVIDER_FAILED", "The student's voice is unavailable right now.");
  }
  const audio = new Uint8Array(await response.arrayBuffer());
  if (audio.byteLength === 0) {
    throw new ServiceError(502, "TTS_PROVIDER_FAILED", "The student's voice is unavailable right now.");
  }
  return audio;
}
