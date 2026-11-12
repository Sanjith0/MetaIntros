/**
 * Server side of the global clock (see lib/clock.ts). The offset is persisted in AppSetting
 * "clockOffsetMs", survives Reset & reseed (the world is reseeded *around* the clock), and is
 * mirrored in memory so synchronous code (DB timestamp defaults, the matcher) can read it.
 */
import { prisma } from "@/lib/db";
import { clockLoaded, clockOffsetMs, nowDate, setClockOffsetInMemory, setWorldWeekendInMemory } from "@/lib/clock";

export const CLOCK_KEY = "clockOffsetMs";

export async function loadClock() {
  if (clockLoaded()) return;
  const [row, weekend] = await Promise.all([
    prisma.appSetting.findUnique({ where: { key: CLOCK_KEY } }),
    prisma.appSetting.findUnique({ where: { key: "weekendStart" } }),
  ]);
  if (weekend) setWorldWeekendInMemory(new Date(weekend.value).getTime());
  setClockOffsetInMemory(row ? Number(row.value) || 0 : 0);
}

export async function getClockOffsetMs(): Promise<number> {
  await loadClock();
  return clockOffsetMs();
}

export async function now(): Promise<Date> {
  await loadClock();
  return nowDate();
}

/** Set the offset outright (tests; seed). Demo controls only ever move it forward via advanceClockTo. */
export async function setClockOffsetMs(ms: number) {
  await prisma.appSetting.upsert({ where: { key: CLOCK_KEY }, create: { key: CLOCK_KEY, value: String(ms) }, update: { value: String(ms) } });
  setClockOffsetInMemory(ms);
}

/** Move the global clock forward (never back) so it reads at least `target`. Returns the new now. */
export async function advanceClockTo(target: Date): Promise<Date> {
  await loadClock();
  const needed = target.getTime() - Date.now();
  if (needed > clockOffsetMs()) await setClockOffsetMs(needed);
  return nowDate();
}
