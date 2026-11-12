import fs from "node:fs";
import path from "node:path";

/**
 * A recorded run: every model call's validated output and latency, keyed by
 * task and agent. Replayed calls are labelled "recorded" on screen, and the
 * recording says what produced it (the real model, or the mock).
 */
export interface RecordedCall {
  value: unknown;
  ms: number;
  source: "model" | "mock" | "fallback";
}

export interface Recording {
  name: string;
  recordedAt: string;
  /** What answered when this was recorded. */
  origin: "model" | "mock" | "mixed";
  calls: Record<string, RecordedCall>;
}

export const RECORDING_DIR = path.join(process.cwd(), "fixtures", "recordings");
export const DEFAULT_RECORDING = "demo-party";

const g = globalThis as unknown as { __pqRecorder?: Record<string, RecordedCall>; __pqRecordings?: Map<string, Recording | null> };

export const callKey = (task: string, agent?: string) => (agent ? `${task}:${agent}` : task);

/** Capture into the in-memory recorder (when recording is on). */
export function capture(key: string, call: RecordedCall) {
  (g.__pqRecorder ??= {})[key] = call;
}

export function takeRecorded(): Record<string, RecordedCall> {
  const out = g.__pqRecorder ?? {};
  g.__pqRecorder = {};
  return out;
}

export function loadRecording(name = DEFAULT_RECORDING): Recording | null {
  const cache = (g.__pqRecordings ??= new Map());
  if (cache.has(name)) return cache.get(name)!;
  let rec: Recording | null = null;
  try {
    rec = JSON.parse(fs.readFileSync(/*turbopackIgnore: true*/ path.join(RECORDING_DIR, `${name}.json`), "utf8")) as Recording;
  } catch {
    rec = null;
  }
  cache.set(name, rec);
  return rec;
}

export function saveRecording(rec: Recording) {
  fs.mkdirSync(/*turbopackIgnore: true*/ RECORDING_DIR, { recursive: true });
  fs.writeFileSync(/*turbopackIgnore: true*/ path.join(RECORDING_DIR, `${rec.name}.json`), JSON.stringify(rec, null, 1) + "\n");
  g.__pqRecordings?.delete(rec.name);
}
