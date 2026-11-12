/**
 * Runtime settings for model calls, changed from the demo control panel.
 * All default off, so the demo path is never slowed unless someone asks.
 * Kept on globalThis so a demo reset of the store does not clear them.
 */
export interface ModelSettings {
  /** Add a realistic per-call delay to mock calls (deterministic per call). */
  simulateLatency: boolean;
  /** Force this agent's calls to exceed the timeout, so the fallback answers. */
  timeoutAgent: string | null;
  /** Per-call timeout for agent turns, in ms. */
  agentTimeoutMs: number;
  /** "live": mock or real per env. "recorded": replay a recorded run. */
  source: "live" | "recorded";
  /** Capture every call into the in-memory recording. */
  record: boolean;
  /** Multiply simulated delays (tests use a small value; the demo uses 1). */
  latencyScale: number;
  /** Pause between table steps, overriding PQ_PACE_MS (null = use the env). */
  paceMs: number | null;
  /** F27: every agent ignores its instructions: accepts every plan and tries to say its person's rules. Code still decides. */
  rogue: boolean;
}

export const DEFAULT_SETTINGS: ModelSettings = {
  simulateLatency: false,
  timeoutAgent: null,
  agentTimeoutMs: 8000,
  source: "live",
  record: false,
  latencyScale: 1,
  paceMs: null,
  rogue: false,
};

const g = globalThis as unknown as { __pqModelSettings?: ModelSettings };

export function modelSettings(): ModelSettings {
  return (g.__pqModelSettings ??= { ...DEFAULT_SETTINGS });
}

export function setModelSettings(patch: Partial<ModelSettings>): ModelSettings {
  g.__pqModelSettings = { ...modelSettings(), ...patch };
  return g.__pqModelSettings;
}

export function resetModelSettings(): ModelSettings {
  g.__pqModelSettings = { ...DEFAULT_SETTINGS };
  return g.__pqModelSettings;
}

/** A stable pseudo-latency for one call: 350 to 1650 ms. */
export function simulatedDelay(key: string): number {
  let h = 2166136261;
  for (const ch of key) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return 350 + (h % 1300);
}
