import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { deepgramUrl, synthesizeWithDeepgram } from "../src/server/tts/deepgram";

const request = { apiKey: "dg-secret", text: "Why does that matter?", voice: "thalia" };

describe("Deepgram text-to-speech client", () => {
  it("requests an Aura-2 English voice as MP3", () => {
    const url = new URL(deepgramUrl("apollo"));
    expect(url.origin + url.pathname).toBe("https://api.deepgram.com/v1/speak");
    expect(url.searchParams.get("model")).toBe("aura-2-apollo-en");
    expect(url.searchParams.get("encoding")).toBe("mp3");
  });

  it("sends the key in a header, not the URL, and returns the audio bytes", async () => {
    const fetcher = vi.fn(async () => new Response(new Uint8Array([7, 8, 9]), { headers: { "content-type": "audio/mpeg" } }));
    expect(await synthesizeWithDeepgram(request, fetcher as unknown as typeof fetch)).toEqual(new Uint8Array([7, 8, 9]));
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).not.toContain("dg-secret");
    expect(new Headers(init.headers).get("authorization")).toBe("Token dg-secret");
    expect(JSON.parse(init.body as string)).toEqual({ text: "Why does that matter?" });
  });

  it("fails once without retrying and never logs the key", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ err_msg: "no credit" }), { status: 402 }));
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(synthesizeWithDeepgram(request, fetcher as unknown as typeof fetch)).rejects.toMatchObject({ code: "TTS_PROVIDER_FAILED" });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(errors.mock.calls)).not.toContain("dg-secret");
    errors.mockRestore();
  });

  it("maps network failures and empty audio to service errors", async () => {
    const offline = vi.fn(async () => { throw new TypeError("network"); });
    await expect(synthesizeWithDeepgram(request, offline as unknown as typeof fetch)).rejects.toMatchObject({ code: "TTS_PROVIDER_UNAVAILABLE" });
    const empty = vi.fn(async () => new Response(new Uint8Array(0)));
    await expect(synthesizeWithDeepgram(request, empty as unknown as typeof fetch)).rejects.toMatchObject({ code: "TTS_PROVIDER_FAILED" });
  });
});
