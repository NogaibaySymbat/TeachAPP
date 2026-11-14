import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("server-only", () => ({}));

import { anonymousId, handle, readBody, sessionId } from "../src/server/http";

describe("API request boundaries", () => {
  it("requires a valid anonymous ID", () => {
    expect(() => anonymousId(new Request("http://localhost/api/topics"))).toThrow("anonymous");
    expect(() => anonymousId(new Request("http://localhost", { headers: { "x-anonymous-id": "invalid" } }))).toThrow();
  });

  it("rejects invalid session IDs", () => {
    expect(() => sessionId("not-a-session")).toThrow("session ID");
  });

  it("returns a structured 400 for malformed JSON", async () => {
    const response = await handle(async () => {
      await readBody(new Request("http://localhost", { method: "POST", body: "{" }), z.object({ text: z.string() }));
      return Response.json({});
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "INVALID_JSON" } });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("rejects a body over the size limit", async () => {
    const response = await handle(async () => {
      await readBody(new Request("http://localhost", { method: "POST", body: JSON.stringify({ text: "x".repeat(32768) }) }), z.object({ text: z.string() }));
      return Response.json({});
    });
    expect(response.status).toBe(413);
  });
});
