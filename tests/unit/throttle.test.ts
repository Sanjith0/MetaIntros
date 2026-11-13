import { describe, expect, it } from "vitest";
import { isRateLimit, makeLimiter, withRateLimitRetry } from "@/lib/ai/throttle";

describe("live-call throttle", () => {
  it("recognises rate-limit errors only", () => {
    expect(isRateLimit(new Error('muse HTTP 429: {"error":{"code":"rate_limit_exceeded"}}'))).toBe(true);
    expect(isRateLimit(new Error("muse HTTP 500: boom"))).toBe(false);
    expect(isRateLimit(new Error("network disabled (blocked api.meta.ai)"))).toBe(false);
  });

  it("retries a 429 with the given backoff, then succeeds", async () => {
    const slept: number[] = [];
    let n = 0;
    const out = await withRateLimitRetry(async () => {
      if (++n < 3) throw new Error("muse HTTP 429: slow down");
      return "ok";
    }, [10, 20, 30], async (ms) => void slept.push(ms));
    expect(out).toBe("ok");
    expect(slept).toEqual([10, 20]);
  });

  it("gives up after the last delay, and never retries other errors", async () => {
    let n = 0;
    await expect(withRateLimitRetry(async () => { n++; throw new Error("HTTP 429"); }, [1, 1], async () => {})).rejects.toThrow("429");
    expect(n).toBe(3);
    n = 0;
    await expect(withRateLimitRetry(async () => { n++; throw new Error("timeout"); }, [1, 1], async () => {})).rejects.toThrow("timeout");
    expect(n).toBe(1);
  });

  it("the limiter never runs more than max at once and runs everything", async () => {
    const run = makeLimiter(3);
    let active = 0, peak = 0, done = 0;
    await Promise.all(Array.from({ length: 12 }, () => run(async () => {
      peak = Math.max(peak, ++active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      done++;
    })));
    expect(peak).toBe(3);
    expect(done).toBe(12);
  });
});
