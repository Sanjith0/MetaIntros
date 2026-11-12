/**
 * Keeps bursts of live model calls inside a provider's rate limit: a cap on how many run at
 * once, and retry with backoff when the provider answers 429. Only rate-limit errors are retried;
 * every other failure (offline, timeout, bad output) still fails fast so the demo never hangs.
 */
export const isRateLimit = (e: unknown) => /\b429\b|rate.?limit/i.test((e as Error)?.message ?? "");

export function makeLimiter(max: number) {
  let active = 0;
  const waiting: (() => void)[] = [];
  return async function run<T>(fn: () => Promise<T>): Promise<T> {
    if (active >= max) await new Promise<void>((r) => waiting.push(r));
    active++;
    try {
      return await fn();
    } finally {
      active--;
      waiting.shift()?.();
    }
  };
}

export async function withRateLimitRetry<T>(fn: () => Promise<T>, delaysMs: number[], sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms))): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (!isRateLimit(e) || attempt >= delaysMs.length) throw e;
      await sleep(delaysMs[attempt]);
    }
  }
}
