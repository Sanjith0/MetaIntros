/**
 * The single entry point for every model call. Guarantees per call:
 *  - mockable (AI_MODE=mock / tests),
 *  - timeout (default 8s) via AbortController,
 *  - cached response (data/ai-cache) and a deterministic fallback, so the demo never blocks,
 *  - schema validation of the model's JSON (invalid → fallback),
 *  - a hard per-process call budget to protect API credit.
 */
import type { z } from "zod";
import { cacheGet, cacheKey, cachePut } from "./cache";
import { MockProvider } from "./providers/mock";
import { fallbackFromEnv, museFromEnv } from "./providers/openaiCompat";
import { makeLimiter, withRateLimitRetry } from "./throttle";
import type { AiMode, AiSource, ChatMessage, LlmProvider } from "./types";
import { summarizeAi, type AiStatus } from "./status";

export type { AiMode, AiSource } from "./types";
export type { AiStatus } from "./status";

const g = globalThis as unknown as { __quAi?: { mode?: AiMode; mock: MockProvider; calls: number; log: AiLogEntry[]; pending?: number } };
const state = (g.__quAi ??= { mock: new MockProvider(), calls: 0, log: [] });

export interface AiLogEntry {
  task: string;
  source: AiSource;
  ms: number;
  error?: string;
  /** epoch ms when the call finished */
  at?: number;
}

export const mockProvider = () => state.mock;
export const aiLog = () => state.log;
/** Live network calls to Muse in flight right now (drives the "what Muse is weighing" lines). */
export const aiPending = () => state.pending ?? 0;

/** Truthful snapshot for the UI badge: built only from the mode, the key and real call results. */
export function aiStatus(): AiStatus {
  return summarizeAi({
    mode: getAiMode(),
    hasKey: Boolean(process.env.MODEL_API_KEY),
    model: process.env.MUSE_MODEL ?? "muse-spark-1.1",
    log: state.log,
    pending: aiPending(),
  });
}

export function getAiMode(): AiMode {
  if (state.mode) return state.mode;
  const env = process.env.AI_MODE;
  if (env === "mock" || env === "live" || env === "cache") return env;
  return process.env.NODE_ENV === "test" ? "mock" : "cache";
}

export function setAiMode(mode: AiMode | undefined) {
  state.mode = mode;
}

export const MAX_LIVE_CALLS = Number(process.env.AI_MAX_CALLS ?? 400);
/** The Companion engine fires a dozen calls per round; stay inside the provider's rate limit. */
const limit = makeLimiter(Number(process.env.AI_CONCURRENCY) || 6);
const RETRY_DELAYS_MS = (process.env.AI_RETRY_MS ?? "3000,8000,15000,30000,30000").split(",").map(Number).filter((n) => n >= 0);

function extractJson(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(t);
  } catch {
    const m = t.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("no JSON object in completion");
    return JSON.parse(m[0]);
  }
}

export interface AiCall<T> {
  task: string;
  system: string;
  user: string;
  schema: z.ZodType<T>;
  fallback: () => T;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}

export interface AiResult<T> {
  value: T;
  source: AiSource;
  error?: string;
}

async function callProvider(p: LlmProvider, task: string, messages: ChatMessage[], c: AiCall<unknown>) {
  const ctl = new AbortController();
  // AI_TIMEOUT_MS raises the floor (the warm script uses it: reasoning models are slow, and warming isn't live).
  const ms = Math.max(c.timeoutMs ?? 8000, Number(process.env.AI_TIMEOUT_MS) || 0);
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    return await p.complete({ task, messages, maxTokens: c.maxTokens, temperature: c.temperature, json: true, timeoutMs: c.timeoutMs }, ctl.signal);
  } finally {
    clearTimeout(timer);
  }
}

export async function runAi<T>(c: AiCall<T>): Promise<AiResult<T>> {
  const t0 = Date.now();
  const messages: ChatMessage[] = [
    { role: "system", content: c.system },
    { role: "user", content: c.user },
  ];
  const mode = getAiMode();
  const done = (r: AiResult<T>) => {
    state.log.push({ task: c.task, source: r.source, ms: Date.now() - t0, error: r.error, at: Date.now() });
    if (state.log.length > 2000) state.log.shift(); // one Companion-engine room is ~45 calls
    return r;
  };
  const parse = (text: string): T => c.schema.parse(extractJson(text));
  const fallback = (error?: string) => done({ value: c.fallback(), source: "fallback", error });

  if (mode === "mock") {
    try {
      const r = await callProvider(state.mock, c.task, messages, c as AiCall<unknown>);
      return done({ value: parse(r.text), source: "mock" });
    } catch (e) {
      return fallback((e as Error).message);
    }
  }

  const key = cacheKey(c.task, messages);
  const cached = cacheGet(key);
  if (cached) {
    try {
      return done({ value: parse(cached), source: "cache" });
    } catch {
      /* stale/invalid cache entry → continue */
    }
  }
  if (mode === "cache") return fallback("cache miss (offline mode)");

  const providers = [museFromEnv(), fallbackFromEnv()].filter(Boolean) as LlmProvider[];
  if (!providers.length) return fallback("no MODEL_API_KEY configured");
  if (state.calls >= MAX_LIVE_CALLS) return fallback("AI call budget exhausted");
  for (const p of providers) {
    try {
      state.calls++;
      state.pending = (state.pending ?? 0) + 1;
      const r = await limit(() => withRateLimitRetry(() => callProvider(p, c.task, messages, c as AiCall<unknown>), RETRY_DELAYS_MS)).finally(() => {
        state.pending = Math.max(0, (state.pending ?? 1) - 1);
      });
      const value = parse(r.text);
      cachePut(key, r.text, { task: c.task, model: r.model, provider: p.name, usage: r.usage });
      return done({ value, source: "live" });
    } catch (e) {
      console.warn(`[ai] ${p.name} ${c.task} failed: ${(e as Error).message}`);
    }
  }
  return fallback("all providers failed");
}
