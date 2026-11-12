import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { runAi, setAiMode } from "@/lib/ai";
import { installNetGuard } from "@/lib/netguard";
import { cacheKey } from "@/lib/ai/cache";

describe("offline resilience", () => {
  afterEach(() => setAiMode(undefined));

  it("with the network down, a live-mode call falls back fast instead of hanging", async () => {
    installNetGuard();
    await expect(fetch("https://api.meta.ai/v1/models")).rejects.toThrow(/network disabled/);
    setAiMode("live");
    process.env.MODEL_API_KEY = "test-key";
    const t0 = Date.now();
    const r = await runAi({ task: "offline_probe", system: "s", user: "u", schema: z.object({ ok: z.boolean() }), fallback: () => ({ ok: true }), timeoutMs: 2000 });
    delete process.env.MODEL_API_KEY;
    expect(r).toMatchObject({ value: { ok: true }, source: "fallback" });
    expect(Date.now() - t0).toBeLessThan(1500);
  });

  it("cache keys are stable for identical prompts (replayable offline)", () => {
    const m = [{ role: "user" as const, content: "x" }];
    expect(cacheKey("t", m)).toBe(cacheKey("t", [...m]));
    expect(cacheKey("t", m)).not.toBe(cacheKey("u", m));
  });
});
