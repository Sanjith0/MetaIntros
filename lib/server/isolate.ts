import { runIsolated } from "./store";

/**
 * Run work (the /evals comparison) against its own store, with live events
 * silenced. The isolation is by async context, so a request that arrives
 * meanwhile keeps using the real store, and nothing needs restoring.
 */
export function isolated<T>(fn: () => Promise<T>): Promise<T> {
  return runIsolated(fn);
}
