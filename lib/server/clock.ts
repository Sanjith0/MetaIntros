/**
 * The demo clock. The demo evening is Nov 14; to show what happens after the
 * event, the control panel can move "now" forward. Real time otherwise.
 */
const g = globalThis as unknown as { __pqClockOffset?: number };

export const demoNow = (): number => Date.now() + (g.__pqClockOffset ?? 0);
export const clockOffset = (): number => g.__pqClockOffset ?? 0;

export function setDemoNow(iso: string | null) {
  g.__pqClockOffset = iso ? Date.parse(iso) - Date.now() : 0;
}

/** Pacific time (the demo city) for a plan's date and clock, as an ISO string. */
export function pacific(date: string, clock: string, addDays = 0): string {
  const d = new Date(`${date}T${clock}:00-08:00`);
  d.setUTCDate(d.getUTCDate() + addDays);
  return d.toISOString();
}

/** A party chat closes 12 hours after the event ends (an end after midnight counts as the next day). */
export function chatExpiry(date: string, start: string, end: string): string {
  const endsNextDay = Number(end.slice(0, 2)) < Number(start.slice(0, 2));
  const ends = Date.parse(pacific(date, end, endsNextDay ? 1 : 0));
  return new Date(ends + 12 * 3600_000).toISOString();
}
