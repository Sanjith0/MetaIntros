import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { mockProvider, runAi, setAiMode } from "@/lib/ai";

const S = z.object({ x: z.number() });
const call = (fallbackX = -1) => runAi({ task: "t", system: "s", user: "u", schema: S, fallback: () => ({ x: fallbackX }), timeoutMs: 200 });

describe("AI adapter", () => {
  afterEach(() => {
    mockProvider().reset();
    setAiMode(undefined);
  });

  it("uses the mock in tests and validates JSON", async () => {
    mockProvider().on("t", () => '```json\n{"x": 3}\n```');
    expect(await call()).toEqual({ value: { x: 3 }, source: "mock" });
  });

  it("falls back on invalid schema, errors and timeouts", async () => {
    mockProvider().on("t", () => '{"x": "nope"}');
    expect((await call(7)).source).toBe("fallback");
    mockProvider().on("t", () => new Promise((r) => setTimeout(() => r('{"x":1}'), 50)));
    expect((await call()).value).toEqual({ x: 1 });
    mockProvider().on("t", () => {
      throw new Error("boom");
    });
    expect(await call(9)).toMatchObject({ value: { x: 9 }, source: "fallback" });
  });

  it("cache mode never touches the network and falls back on a miss", async () => {
    setAiMode("cache");
    const r = await call(5);
    expect(r).toMatchObject({ value: { x: 5 }, source: "fallback" });
    expect(r.error).toMatch(/cache miss/);
  });

  it("live mode without a key falls back instead of failing", async () => {
    setAiMode("live");
    const old = process.env.MODEL_API_KEY;
    delete process.env.MODEL_API_KEY;
    expect((await call(4)).value).toEqual({ x: 4 });
    if (old !== undefined) process.env.MODEL_API_KEY = old;
  });
});
