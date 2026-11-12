import type { Trace } from "@/contracts";
import { nowIso, store } from "./store";

type Listener = (t: Trace) => void;
const g = globalThis as unknown as { __pqTraceListeners?: Set<Listener> };
const listeners = () => (g.__pqTraceListeners ??= new Set());

/** Append to the stage trace. Private-lane traces are for the projector
 *  (/stage) only: they are never sent to a member's browser. */
export function trace(
  partyId: string,
  lane: Trace["lane"],
  conversation: Trace["conversation"],
  actorId: string | null,
  title: string,
  body: string,
  extra: { tone?: Trace["tone"]; meta?: Trace["meta"] } = {},
): Trace {
  const s = store();
  const t: Trace = { id: `tr-${s.version}-${s.traces.length + 1}`, partyId, seq: s.traces.length, lane, conversation, actorId, title, body, at: nowIso(), ...extra };
  s.traces.push(t);
  for (const l of listeners()) {
    try {
      l(t);
    } catch {}
  }
  return t;
}

export function onTrace(fn: Listener): () => void {
  listeners().add(fn);
  return () => listeners().delete(fn);
}
