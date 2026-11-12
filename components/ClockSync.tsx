"use client";

import { setClockOffsetInMemory } from "@/lib/clock";

/**
 * Ships the global clock's offset to the browser (lib/clock.ts). Set during render — before any
 * sibling that formats time renders — so server HTML and the hydrated client agree. Re-renders on
 * router.refresh() (LiveRefresher fires one on Fast-forward), so every phone moves together.
 */
export function ClockSync({ offsetMs }: { offsetMs: number }) {
  if (typeof window !== "undefined") setClockOffsetInMemory(offsetMs);
  return null;
}
