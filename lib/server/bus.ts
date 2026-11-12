import { PQEvent, type Audience, type EventType, type PayloadOf } from "@/contracts";
import { isIsolated, nowIso, store } from "./store";

type Listener = (e: PQEvent) => void;
const g = globalThis as unknown as { __pqListeners?: Set<Listener> };
const listeners = () => (g.__pqListeners ??= new Set());

/** Publish one realtime event. The envelope is validated against the
 *  contract before anyone hears it, so a payload with a stray field
 *  (a reason on plan.unavailable, say) throws here instead of leaking. */
export function publish<T extends EventType>(
  type: T,
  payload: PayloadOf<T>,
  audience: string[] | "all",
  opts: { stage?: boolean } = {},
): PQEvent {
  const s = store();
  s.seq += 1;
  const aud: Audience = audience === "all" ? { kind: "all" } : { kind: "users", userIds: [...new Set(audience)] };
  const event = PQEvent.parse({
    id: `ev-${s.seq}`,
    seq: s.seq,
    at: nowIso(),
    type,
    audience: aud,
    stage: opts.stage ?? false,
    payload,
  });
  s.events_log.push(event);
  if (isIsolated()) return event; // an isolated eval run never reaches a live browser
  for (const l of listeners()) {
    try {
      l(event);
    } catch {
      /* a broken subscriber must not break the publisher */
    }
  }
  return event;
}

export function subscribe(fn: Listener): () => void {
  listeners().add(fn);
  return () => listeners().delete(fn);
}

/** Can this viewer (or the stage) see this event? */
export function visibleTo(e: PQEvent, viewer: { userId?: string; stage?: boolean }): boolean {
  if (viewer.stage) return e.stage || e.audience.kind === "all";
  if (e.audience.kind === "all") return true;
  return !!viewer.userId && e.audience.userIds.includes(viewer.userId);
}
