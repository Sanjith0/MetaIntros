import { store } from "./store";

type G = { __pq?: ReturnType<typeof store>; __pqSilent?: boolean; __pqIsolated?: Promise<unknown> };
const g = globalThis as unknown as G;

/**
 * Run work against a throwaway store with live events silenced, then put the
 * real store back. Used by /evals so a comparison never touches a live demo
 * (no toasts, no MATCH FOUND on anyone's phone). Runs are serialized.
 */
export async function isolated<T>(fn: () => Promise<T>): Promise<T> {
  const prev = g.__pqIsolated ?? Promise.resolve();
  let release!: () => void;
  g.__pqIsolated = new Promise<void>((r) => (release = r));
  await prev.catch(() => {});
  const saved = g.__pq;
  g.__pqSilent = true;
  try {
    return await fn();
  } finally {
    g.__pq = saved;
    g.__pqSilent = false;
    release();
  }
}
