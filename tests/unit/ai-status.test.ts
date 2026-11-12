import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { aiLog, aiPending, aiStatus, mockProvider, runAi, setAiMode } from "@/lib/ai";
import { combineSources, describeSource, stepSource, summarizeAi } from "@/lib/ai/status";
import type { AiSource } from "@/lib/ai/types";

const log = (...s: AiSource[]) => s.map((source) => ({ source, error: source === "fallback" ? "all providers failed" : undefined }));
const base = { model: "muse-spark-1.3", hasKey: true };

describe("AI status badge (truthful labels)", () => {
  it("mock mode never claims Muse", () => {
    const s = summarizeAi({ ...base, mode: "mock", log: log("mock", "mock") });
    expect(s.state).toBe("mock");
    expect(s.label).not.toMatch(/Muse/);
  });

  it("cache mode is labeled replay, never live", () => {
    const s = summarizeAi({ ...base, mode: "cache", log: log("cache", "cache", "fallback") });
    expect(s.state).toBe("replay");
    expect(s.label).toBe("Muse replay");
    expect(s.label).not.toMatch(/live/i);
    expect(s.detail).toMatch(/Cache misses used templates/);
    expect(s.recent).toEqual({ live: 0, cache: 2, mock: 0, fallback: 1 });
  });

  it("cache mode with only misses says templates, not Muse", () => {
    const s = summarizeAi({ ...base, mode: "cache", log: log("fallback", "fallback") });
    expect(s.state).toBe("offline");
    expect(s.label).toBe("Templates");
  });

  it("live mode without a key is offline", () => {
    expect(summarizeAi({ ...base, hasKey: false, mode: "live", log: [] }).state).toBe("offline");
  });

  it("live mode is degraded while recent calls fall back, and recovers after clean calls", () => {
    const bad = summarizeAi({ ...base, mode: "live", log: log("live", "live", "fallback") });
    expect(bad.state).toBe("degraded");
    expect(bad.detail).toMatch(/all providers failed/);
    const ok = summarizeAi({ ...base, mode: "live", log: log("fallback", "live", "live", "live", "live", "live") });
    expect(ok.state).toBe("live");
    expect(ok.label).toBe("Muse live");
  });

  it("combining sources never rounds up", () => {
    expect(combineSources(["live", "live"])).toBe("live");
    expect(combineSources(["live", "cache"])).toBe("cache");
    expect(combineSources(["cache", "template"])).toBe("mixed");
    expect(combineSources(["template", "fallback"])).toBe("template");
    expect(combineSources(["mock", "template"])).toBe("mock");
    expect(combineSources([])).toBe("code");
  });

  it("per-output labels only say Muse when a Muse model wrote it", () => {
    expect(describeSource("live")).toMatchObject({ label: "Muse · live", muse: true });
    expect(describeSource("cache")).toMatchObject({ label: "Muse · replay", muse: true });
    for (const s of ["fallback", "template", "mock", "code"]) expect(describeSource(s)?.muse, s).toBe(false);
    expect(describeSource(undefined)).toBeNull();
  });

  it("trace steps: model steps use their recorded source, tool calls and safety checks are code", () => {
    expect(stepSource({ kind: "reasoning", output: { source: "cache" } })).toBe("cache");
    expect(stepSource({ kind: "tool_call", output: { score: 1 } })).toBe("code");
    expect(stepSource({ kind: "safety_check", output: null })).toBe("code");
    expect(stepSource({ kind: "decision", output: { eventId: "x" } })).toBeNull();
  });
});

describe("AI status from real calls", () => {
  const S = z.object({ x: z.number() });
  const old = { key: process.env.MODEL_API_KEY, url: process.env.MUSE_BASE_URL };
  afterEach(() => {
    vi.unstubAllGlobals();
    mockProvider().reset();
    setAiMode(undefined);
    if (old.key === undefined) delete process.env.MODEL_API_KEY;
    else process.env.MODEL_API_KEY = old.key;
    process.env.MUSE_BASE_URL = old.url;
  });

  it("counts live calls in flight and logs them as live", async () => {
    setAiMode("live");
    process.env.MODEL_API_KEY = "test-key";
    process.env.MUSE_BASE_URL = "https://muse.test/v1";
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    vi.stubGlobal("fetch", vi.fn(async () => {
      await gate;
      return new Response(JSON.stringify({ model: "muse-spark-1.3", choices: [{ message: { content: '{"x": 2}' }, finish_reason: "stop" }] }), { status: 200 });
    }));
    const p = runAi({ task: "status_live_probe", system: "s", user: `u${Date.now()}`, schema: S, fallback: () => ({ x: -1 }), timeoutMs: 2000 });
    await new Promise((r) => setTimeout(r, 10));
    expect(aiPending()).toBe(1);
    expect(aiStatus().pending).toBe(1);
    release();
    expect(await p).toMatchObject({ value: { x: 2 }, source: "live" });
    expect(aiPending()).toBe(0);
    expect(aiLog().at(-1)).toMatchObject({ task: "status_live_probe", source: "live" });
  });

  it("a failing Muse call turns the badge degraded, not live", async () => {
    setAiMode("live");
    process.env.MODEL_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));
    const r = await runAi({ task: "status_fail_probe", system: "s", user: `u${Date.now()}`, schema: S, fallback: () => ({ x: -1 }), timeoutMs: 2000 });
    expect(r.source).toBe("fallback");
    expect(aiPending()).toBe(0);
    expect(aiStatus().state).toBe("degraded");
  });

  it("test runs report mock", () => {
    expect(aiStatus().state).toBe("mock");
  });
});
