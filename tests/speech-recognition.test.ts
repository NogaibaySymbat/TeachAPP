import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSpeechController, getSpeechSupport, truncateSpeechText,
  type BrowserSpeechRecognition, type SpeechResult, type SpeechSnapshot,
} from "../src/lib/speech-recognition";

class FakeRecognition implements BrowserSpeechRecognition {
  static instances: FakeRecognition[] = [];
  lang = "";
  continuous = false;
  interimResults = false;
  maxAlternatives = 0;
  onstart: BrowserSpeechRecognition["onstart"] = null;
  onend: BrowserSpeechRecognition["onend"] = null;
  onerror: BrowserSpeechRecognition["onerror"] = null;
  onresult: BrowserSpeechRecognition["onresult"] = null;
  start = vi.fn();
  stop = vi.fn();
  abort = vi.fn();
  constructor() { FakeRecognition.instances.push(this); }
}

function result(text: string, isFinal = true): SpeechResult {
  return { isFinal, length: 1, 0: { transcript: text } };
}

function setup(maxCharacters = 4000) {
  const changes: SpeechSnapshot[] = [];
  const controller = createSpeechController({ Recognition: FakeRecognition, maxCharacters, onChange: (state) => changes.push(state) });
  return {
    controller, changes,
    latest: () => changes.at(-1)!,
    recognizer: () => FakeRecognition.instances.at(-1)!,
    listen: () => { controller.start("ru-RU"); FakeRecognition.instances.at(-1)!.onstart?.(); },
  };
}

beforeEach(() => { vi.useFakeTimers(); FakeRecognition.instances = []; });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("browser speech support", () => {
  it("supports standard and prefixed APIs without opening the microphone", () => {
    expect(getSpeechSupport({ isSecureContext: true, SpeechRecognition: FakeRecognition })).toEqual({ available: true, Recognition: FakeRecognition });
    expect(getSpeechSupport({ isSecureContext: true, webkitSpeechRecognition: FakeRecognition })).toEqual({ available: true, Recognition: FakeRecognition });
    expect(FakeRecognition.instances).toHaveLength(0);
  });

  it("provides a safe typing fallback for SSR, unsupported browsers, and insecure pages", () => {
    vi.stubGlobal("window", undefined);
    expect(getSpeechSupport()).toMatchObject({ available: false, code: "unsupported" });
    expect(getSpeechSupport({ isSecureContext: true })).toMatchObject({ available: false, code: "unsupported" });
    expect(getSpeechSupport({ isSecureContext: false, SpeechRecognition: FakeRecognition })).toMatchObject({ available: false, code: "insecure" });
    expect(FakeRecognition.instances).toHaveLength(0);
  });
});

describe("speech controller", () => {
  it("starts only on request and ignores repeated starts while active", () => {
    const { controller, recognizer, latest } = setup();
    expect(FakeRecognition.instances).toHaveLength(0);
    controller.start("ru-RU");
    controller.start("en-US");
    expect(FakeRecognition.instances).toHaveLength(1);
    expect(recognizer()).toMatchObject({ lang: "ru-RU", continuous: true, interimResults: true, maxAlternatives: 1 });
    expect(recognizer().start).toHaveBeenCalledTimes(1);
    expect(latest().state).toBe("starting");
    recognizer().onstart?.();
    expect(latest().state).toBe("listening");
  });

  it("replaces interim hypotheses and never duplicates previously finalized text", () => {
    const { listen, recognizer, latest } = setup();
    listen();
    recognizer().onresult?.({ results: [result("A stakeholder"), result("mat", false)] });
    expect(latest()).toMatchObject({ finalText: "A stakeholder", interimText: "mat" });
    recognizer().onresult?.({ results: [result("A stakeholder"), result("matters", false)] });
    expect(latest()).toMatchObject({ finalText: "A stakeholder", interimText: "matters" });
    recognizer().onresult?.({ results: [result("A stakeholder"), result("matters.")] });
    recognizer().onresult?.({ results: [result("A stakeholder"), result("matters.")] });
    expect(latest()).toMatchObject({ finalText: "A stakeholder matters.", interimText: "" });
  });

  it("waits for the final result after Stop, then returns to idle without restarting", () => {
    const { controller, listen, recognizer, latest } = setup();
    listen();
    recognizer().onresult?.({ results: [result("Draft", false)] });
    controller.stop();
    controller.stop();
    expect(latest().state).toBe("stopping");
    expect(recognizer().stop).toHaveBeenCalledTimes(1);
    recognizer().onresult?.({ results: [result("Final dictated explanation.")] });
    recognizer().onend?.();
    expect(latest()).toMatchObject({ state: "idle", finalText: "Final dictated explanation.", interimText: "", error: null });
    vi.advanceTimersByTime(100_000);
    expect(FakeRecognition.instances).toHaveLength(1);
    expect(recognizer().start).toHaveBeenCalledTimes(1);
  });

  it.each(["not-allowed", "service-not-allowed", "audio-capture", "network", "language-not-supported", "no-speech", "aborted"])("handles %s safely and ignores error-following events", (error) => {
    const { listen, recognizer, latest, changes } = setup();
    listen();
    recognizer().onresult?.({ results: [result("Keep this final text."), result("unconfirmed", false)] });
    const lateEnd = recognizer().onend!;
    const lateResult = recognizer().onresult!;
    recognizer().onerror?.({ error });
    const count = changes.length;
    lateEnd();
    lateResult({ results: [result("Late text must not replace anything.")] });
    expect(changes).toHaveLength(count);
    expect(latest()).toMatchObject({ state: "idle", finalText: "Keep this final text.", interimText: "", error: { code: error } });
    expect(recognizer().abort).toHaveBeenCalledTimes(1);
  });

  it("cancels a pending permission request and ignores a late start", () => {
    const { controller, recognizer, latest, changes } = setup();
    controller.start("en-US");
    const lateStart = recognizer().onstart!;
    controller.cancel();
    const count = changes.length;
    lateStart();
    vi.advanceTimersByTime(100_000);
    expect(latest().state).toBe("idle");
    expect(changes).toHaveLength(count);
    expect(recognizer().abort).toHaveBeenCalledTimes(1);
  });

  it("fences old events after a new run and resets the transcript for the new run", () => {
    const { controller, listen, recognizer, latest } = setup();
    listen();
    const first = recognizer();
    first.onresult?.({ results: [result("Old run")] });
    const lateResult = first.onresult!;
    controller.cancel();
    controller.start("en-US");
    recognizer().onstart?.();
    lateResult({ results: [result("Stale overwrite")] });
    expect(latest()).toMatchObject({ state: "listening", finalText: "", interimText: "" });
    recognizer().onresult?.({ results: [result("New run")] });
    expect(latest().finalText).toBe("New run");
  });

  it("aborts on disposal and never emits updates or starts again", () => {
    const { controller, listen, recognizer, changes } = setup();
    listen();
    const oldResult = recognizer().onresult!;
    const count = changes.length;
    controller.dispose();
    oldResult({ results: [result("Late")] });
    controller.start("en-US");
    controller.cancel();
    vi.advanceTimersByTime(100_000);
    expect(changes).toHaveLength(count);
    expect(FakeRecognition.instances).toHaveLength(1);
    expect(recognizer().abort).toHaveBeenCalledTimes(1);
  });

  it("permanently clears accepted or discarded text so later cancellation cannot restore it", () => {
    const { controller, listen, recognizer, latest } = setup();
    listen();
    recognizer().onresult?.({ results: [result("Accepted text")] });
    const oldResult = recognizer().onresult!;
    controller.clear();
    controller.cancel();
    oldResult({ results: [result("Stale text")] });
    expect(latest()).toEqual({ state: "idle", finalText: "", interimText: "", error: null, limited: false });
    expect(recognizer().abort).toHaveBeenCalledTimes(1);
  });

  it("bounds starting and finalization waits so the form can recover", () => {
    const { controller, recognizer, latest } = setup();
    controller.start("en-US");
    vi.advanceTimersByTime(15_000);
    expect(latest()).toMatchObject({ state: "idle", error: { code: "start-timeout" } });
    expect(recognizer().abort).toHaveBeenCalledTimes(1);
    controller.start("en-US");
    recognizer().onstart?.();
    recognizer().onresult?.({ results: [result("Keep this text.")] });
    controller.stop();
    vi.advanceTimersByTime(5000);
    expect(latest()).toMatchObject({ state: "idle", finalText: "Keep this text.", error: { code: "stop-timeout" } });
  });

  it("stops listening after one minute and accepts the final result", () => {
    const { listen, recognizer, latest } = setup();
    listen();
    vi.advanceTimersByTime(60_000);
    expect(latest()).toMatchObject({ state: "stopping", limited: true });
    expect(recognizer().stop).toHaveBeenCalledTimes(1);
    recognizer().onresult?.({ results: [result("A complete thought.")] });
    recognizer().onend?.();
    expect(latest()).toMatchObject({ state: "idle", finalText: "A complete thought.", limited: true, error: null });
  });

  it("caps final text to the remaining draft room without breaking emoji", () => {
    const { controller, recognizer, latest } = setup();
    controller.start("en-US", 4);
    recognizer().onstart?.();
    recognizer().onresult?.({ results: [result("abc😀def", false)] });
    expect(latest()).toMatchObject({ state: "listening", interimText: "abc" });
    expect(recognizer().stop).not.toHaveBeenCalled();
    recognizer().onresult?.({ results: [result("abc😀def")] });
    expect(latest()).toMatchObject({ state: "stopping", finalText: "abc", limited: true });
    expect(recognizer().stop).toHaveBeenCalledTimes(1);
    expect(truncateSpeechText("ab😀cd", 4)).toBe("ab😀");
  });

  it("does not request microphone access when the composer has no room", () => {
    const { controller, latest } = setup();
    controller.start("en-US", 0);
    expect(latest()).toMatchObject({ state: "idle", limited: true });
    expect(FakeRecognition.instances).toHaveLength(0);
  });

  it("reports a recognizer that ends without final speech", () => {
    const { listen, recognizer, latest } = setup();
    listen();
    recognizer().onend?.();
    expect(latest()).toMatchObject({ state: "idle", error: { code: "no-speech" } });
  });

  it("handles a synchronous permission failure without leaving timers or capture active", () => {
    class DeniedRecognition extends FakeRecognition {
      start = vi.fn(() => { throw new DOMException("Do not reveal raw errors", "NotAllowedError"); });
    }
    const onChange = vi.fn();
    const controller = createSpeechController({ Recognition: DeniedRecognition, onChange });
    controller.start("en-US");
    expect(onChange.mock.calls.at(-1)?.[0]).toMatchObject({ state: "idle", error: { code: "not-allowed" } });
    expect(JSON.stringify(onChange.mock.calls)).not.toContain("Do not reveal raw errors");
    expect(vi.getTimerCount()).toBe(0);
    expect(FakeRecognition.instances[0].abort).toHaveBeenCalledTimes(1);
  });
});
