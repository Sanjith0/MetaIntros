import type { AvailabilityWindow } from "@/lib/profile/builder";

type Interval = [number, number];

function byDay(ws: AvailabilityWindow[]): Map<number, Interval[]> {
  const m = new Map<number, Interval[]>();
  for (const w of ws) {
    if (w.endMin <= w.startMin) continue;
    const arr = m.get(w.dayOfWeek) ?? [];
    arr.push([w.startMin, w.endMin]);
    m.set(w.dayOfWeek, arr);
  }
  // merge overlaps within a day
  for (const [d, arr] of m) {
    arr.sort((a, b) => a[0] - b[0]);
    const merged: Interval[] = [];
    for (const iv of arr) {
      const last = merged[merged.length - 1];
      if (last && iv[0] <= last[1]) last[1] = Math.max(last[1], iv[1]);
      else merged.push([...iv]);
    }
    m.set(d, merged);
  }
  return m;
}

function intersect(a: Interval[], b: Interval[]): Interval[] {
  const out: Interval[] = [];
  for (const x of a) for (const y of b) {
    const s = Math.max(x[0], y[0]);
    const e = Math.min(x[1], y[1]);
    if (e > s) out.push([s, e]);
  }
  return out;
}

export const totalMinutes = (ws: AvailabilityWindow[]) =>
  [...byDay(ws).values()].flat().reduce((s, [a, b]) => s + (b - a), 0);

/** Windows where *everyone* is free. */
export function commonWindows(all: AvailabilityWindow[][]): AvailabilityWindow[] {
  if (all.length === 0) return [];
  let acc = byDay(all[0]);
  for (const ws of all.slice(1)) {
    const other = byDay(ws);
    const next = new Map<number, Interval[]>();
    for (const [d, ivs] of acc) {
      const o = other.get(d);
      if (!o) continue;
      const x = intersect(ivs, o);
      if (x.length) next.set(d, x);
    }
    acc = next;
  }
  return [...acc.entries()]
    .flatMap(([d, ivs]) => ivs.map(([s, e]) => ({ dayOfWeek: d, startMin: s, endMin: e })))
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startMin - b.startMin);
}

export function overlapMinutes(a: AvailabilityWindow[], b: AvailabilityWindow[]): number {
  return totalMinutes(commonWindows([a, b]));
}

export function longestWindow(ws: AvailabilityWindow[]): AvailabilityWindow | null {
  let best: AvailabilityWindow | null = null;
  for (const w of ws) if (!best || w.endMin - w.startMin > best.endMin - best.startMin) best = w;
  return best;
}

/** True if a concrete time range (local) falls entirely inside one of the windows. */
export function coversRange(ws: AvailabilityWindow[], start: Date, end: Date): boolean {
  if (start.getDay() !== end.getDay() && !(end.getHours() === 0 && end.getMinutes() === 0)) {
    // events past midnight: only check the start-day portion up to 24:00
    return coversRange(ws, start, new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1));
  }
  const day = start.getDay();
  const s = start.getHours() * 60 + start.getMinutes();
  const e = end.getDay() !== day ? 1440 : end.getHours() * 60 + end.getMinutes();
  return ws.some((w) => w.dayOfWeek === day && w.startMin <= s && w.endMin >= e);
}
