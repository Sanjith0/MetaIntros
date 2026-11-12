/**
 * The global clock. Queue Up runs on ONE clock: real time + a demo offset that only moves forward
 * (Fast-forward ends an event by advancing it for everyone). Every timestamp the app stores,
 * compares or shows comes from here — server code, DB defaults (lib/db.ts) and the browser (the
 * root layout ships the offset to the client via <ClockSync/>) — so nothing can drift apart.
 *
 * Pure stopwatches (AI latency, SSE liveness) may still use Date.now(): they measure durations,
 * not points in time.
 */
type G = { __quClockOffset?: number; __quWeekendStart?: number };
const g = globalThis as G;

export const clockOffsetMs = () => g.__quClockOffset ?? 0;
export const clockLoaded = () => g.__quClockOffset !== undefined;
export const nowMs = () => Date.now() + clockOffsetMs();
export const nowDate = () => new Date(nowMs());

/**
 * The demo world's weekend (Friday 00:00, ms) chosen at seed time: the next weekend that's still
 * ahead on the global clock. "This weekend" everywhere means this weekend, so a reseed after a
 * Fast-forward always yields upcoming events.
 */
export const worldWeekendStartMs = () => g.__quWeekendStart;
export function setWorldWeekendInMemory(ms: number | undefined) {
  g.__quWeekendStart = ms;
}

/** Process-local copy of the offset (server: loaded from the DB once; client: from ClockSync). */
export function setClockOffsetInMemory(ms: number) {
  g.__quClockOffset = ms;
}
