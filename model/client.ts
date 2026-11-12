import { AsyncLocalStorage } from "node:async_hooks";
import fs from "node:fs";
import path from "node:path";
import type { z } from "zod";
import { callKey, capture, loadRecording } from "./recording";
import { modelSettings, simulatedDelay } from "./settings";

/**
 * One client for the Meta Model API (OpenAI-compatible chat completions).
 *
 * - MOCK_MODEL=1 returns the caller's mock (deterministic fixture logic).
 *   It is the default whenever META_API_KEY is not set.
 * - Every call returns Zod-validated JSON.
 * - Every call has a timeout and a deterministic fallback.
 * - Real calls are capped for the night (MODEL_CALL_CAP, default 300).
 * - The key is never printed or logged.
 */

export type ModelRole = "spark" | "ember";
export type ModelSource = "model" | "mock" | "fallback" | "recorded";

export interface ModelResult<T> {
  value: T;
  source: ModelSource;
  ms: number;
  /** Why we fell back, if we did. Never contains the key. */
  note?: string;
}

export interface CallOptions<T> {
  role: ModelRole;
  task: string;
  system: string;
  user: string;
  schema: z.ZodType<T>;
  /** Used when MOCK_MODEL is on. Must be deterministic. */
  mock: () => T;
  /** Used when the real call fails, times out, is over the cap, or returns invalid JSON. */
  fallback: () => T;
  timeoutMs?: number;
  /** Which agent (owner id, or a pair key) is calling. Keys recordings, timeouts and latency labels. */
  agent?: string;
}

/* --------------------------- sandbox scope --------------------------- */

const gm = globalThis as unknown as { __pqMockScope?: AsyncLocalStorage<true> };
const mockScope = (gm.__pqMockScope ??= new AsyncLocalStorage<true>());

/** Run work on the deterministic mock only: no real calls, no latency, no recordings (sandbox "what if" runs). */
export function withMockModel<T>(fn: () => Promise<T>): Promise<T> {
  return mockScope.run(true, fn);
}
export const inMockScope = () => mockScope.getStore() === true;

export function modelConfig() {
  const key = process.env.META_API_KEY ?? "";
  const mockFlag = process.env.MOCK_MODEL;
  const mock = mockFlag === "1" || (mockFlag !== "0" && !key);
  return {
    hasKey: key.length > 0,
    mock,
    baseUrl: (process.env.META_API_BASE_URL ?? "https://api.llama.com/compat/v1").replace(/\/+$/, ""),
    spark: process.env.MUSE_SPARK_MODEL ?? "muse-spark",
    ember: process.env.MUSE_EMBER_MODEL ?? "muse-ember",
    cap: Number(process.env.MODEL_CALL_CAP ?? 300),
  };
}

/* ---------------------------- call counter ---------------------------- */

const counterFile = () =>
  process.env.MODEL_COUNTER_FILE ?? path.join(process.cwd(), ".overnight", "model-calls.json");

function readCount(): number {
  try {
    return Number(JSON.parse(fs.readFileSync(/*turbopackIgnore: true*/ counterFile(), "utf8")).count) || 0;
  } catch {
    return 0;
  }
}

function bumpCount(): number {
  const next = readCount() + 1;
  try {
    fs.mkdirSync(/*turbopackIgnore: true*/ path.dirname(counterFile()), { recursive: true });
    fs.writeFileSync(/*turbopackIgnore: true*/ counterFile(), JSON.stringify({ count: next, updatedAt: new Date().toISOString() }));
  } catch {
    /* counting is best effort; the in-memory guard below still applies */
  }
  return next;
}

export function realCallsUsed(): number {
  return readCount();
}

/* ------------------------------ helpers ------------------------------ */

export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced?.[1] ?? text).trim();
  const start = body.search(/[[{]/);
  if (start < 0) throw new Error("no JSON object in reply");
  return JSON.parse(body.slice(start));
}

async function postChat(cfg: ReturnType<typeof modelConfig>, model: string, system: string, user: string, timeoutMs: number) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.META_API_KEY ?? ""}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("empty completion");
    return content;
  } finally {
    clearTimeout(timer);
  }
}

/* -------------------------------- call -------------------------------- */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function callModel<T>(opts: CallOptions<T>): Promise<ModelResult<T>> {
  const result = await callModelInner(opts);
  if (modelSettings().record && result.source !== "recorded" && !inMockScope()) {
    capture(callKey(opts.task, opts.agent), { value: result.value, ms: result.ms, source: result.source });
  }
  return result;
}

async function callModelInner<T>(opts: CallOptions<T>): Promise<ModelResult<T>> {
  const t0 = Date.now();
  const cfg = modelConfig();
  const st = modelSettings();
  const key = callKey(opts.task, opts.agent);
  const timeoutMs = opts.timeoutMs ?? (opts.agent ? st.agentTimeoutMs : 15_000);

  const safe = (fn: () => T, source: ModelSource, note?: string): ModelResult<T> => {
    const value = opts.schema.parse(fn());
    return { value, source, ms: Date.now() - t0, note };
  };
  if (inMockScope()) return safe(opts.mock, "mock");

  // A recorded run replays exactly, labelled as recorded.
  if (st.source === "recorded") {
    const rec = loadRecording();
    const hit = rec?.calls[key];
    const parsed = hit ? opts.schema.safeParse(hit.value) : null;
    if (rec && hit && parsed?.success) {
      if (st.simulateLatency) await sleep(Math.min(hit.ms, 2000));
      return { value: parsed.data, source: "recorded", ms: hit.ms, note: `recorded from the ${rec.origin} model, ${rec.recordedAt.slice(0, 16).replace("T", " ")} UTC` };
    }
  }

  if (cfg.mock) {
    // Optional: behave like a network call, including one agent that times out.
    const forced = !!opts.agent && st.timeoutAgent === opts.agent;
    if (st.simulateLatency || forced) {
      const delay = forced ? timeoutMs + 1 : Math.round(simulatedDelay(key) * st.latencyScale);
      await sleep(Math.min(delay, timeoutMs));
      if (delay > timeoutMs) return safe(opts.fallback, "fallback", `timeout after ${timeoutMs} ms`);
    }
    return safe(opts.mock, "mock");
  }
  if (!cfg.hasKey) return safe(opts.fallback, "fallback", "no key");
  if (readCount() >= cfg.cap) return safe(opts.fallback, "fallback", "call cap reached");

  const model = opts.role === "spark" ? cfg.spark : cfg.ember;
  try {
    bumpCount();
    const content = await postChat(cfg, model, opts.system, opts.user, timeoutMs);
    const parsed = opts.schema.safeParse(extractJson(content));
    if (!parsed.success) return safe(opts.fallback, "fallback", `invalid JSON for ${opts.task}`);
    return { value: parsed.data, source: "model", ms: Date.now() - t0 };
  } catch (err) {
    const note = err instanceof Error && err.name === "AbortError" ? `timeout after ${timeoutMs} ms` : `error: ${(err as Error).message}`;
    return safe(opts.fallback, "fallback", note);
  }
}
