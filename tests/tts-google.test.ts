import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buildSynthesisBody, synthesizeSpeech } from "../src/server/tts/google";

const request = { apiKey: "test-key", text: "Why does that matter?", languageCode: "en-US" as const, voice: "Leda" };

describe("Google text-to-speech client", () => {
  it("builds a Chirp 3 HD request", () => {
    expect(buildSynthesisBody({ text: "Привет", languageCode: "ru-RU", voice: "Puck" })).toEqual({
      input: { text: "Привет" },
      voice: { languageCode: "ru-RU", name: "ru-RU-Chirp3-HD-Puck" },
      audioConfig: { audioEncoding: "MP3" },
    });
  });

  it("sends the key in a header, not the URL, and decodes audio", async () => {
    const fetcher = vi.fn(async () => Response.json({ audioContent: Buffer.from("mp3-bytes").toString("base64") }));
    const audio = await synthesizeSpeech(request, fetcher as unknown as typeof fetch);
    expect(Buffer.from(audio).toString()).toBe("mp3-bytes");
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).not.toContain("test-key");
    expect(new Headers(init.headers).get("x-goog-api-key")).toBe("test-key");
  });

  it("fails once without retrying on provider errors", async () => {
    const fetcher = vi.fn(async () => new Response("quota", { status: 429 }));
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(synthesizeSpeech(request, fetcher as unknown as typeof fetch)).rejects.toMatchObject({ code: "TTS_PROVIDER_FAILED" });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(errors.mock.calls)).not.toContain("test-key");
    errors.mockRestore();
  });

  it("maps network failures and empty audio to service errors", async () => {
    const offline = vi.fn(async () => { throw new TypeError("network"); });
    await expect(synthesizeSpeech(request, offline as unknown as typeof fetch)).rejects.toMatchObject({ code: "TTS_PROVIDER_UNAVAILABLE" });
    const empty = vi.fn(async () => Response.json({}));
    await expect(synthesizeSpeech(request, empty as unknown as typeof fetch)).rejects.toMatchObject({ code: "TTS_PROVIDER_FAILED" });
  });
});
