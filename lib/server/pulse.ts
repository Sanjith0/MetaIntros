import { prisma } from "@/lib/db";

/**
 * Queue pulse: how many people are waiting right now (optionally for one event) and how many squads are
 * already going. Counts only, never faces: who is going alone, where, tonight, is a targeting signal
 * (council: trust & safety). Waiting counts under PULSE_MIN are not shown at all.
 */
export const PULSE_MIN = 5;
export async function queuePulse(eventId?: string) {
  const [waiting, squads] = await Promise.all([
    prisma.queueEntry.findMany({
      where: { status: "waiting", ...(eventId ? { OR: [{ eventId }, { eventId: null, mode: "events" }] } : {}) },
      select: { id: true, bucketLandmark: { select: { name: true } } },
      orderBy: { joinedAt: "asc" },
      take: 50,
    }),
    eventId ? prisma.party.count({ where: { eventId, status: { in: ["confirmed", "completed"] } } }) : Promise.resolve(0),
  ]);
  const areas = new Map<string, number>();
  for (const w of waiting) areas.set(w.bucketLandmark.name, (areas.get(w.bucketLandmark.name) ?? 0) + 1);
  const topArea = [...areas.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return {
    waiting: waiting.length,
    topArea,
    squads,
  };
}

/** "7 people are queuing near Downtown Palo Alto · 1 squad is going". Small waiting counts stay hidden. */
export function pulseLine(p: { waiting: number; topArea: string | null; squads: number }) {
  const parts: string[] = [];
  if (p.waiting >= PULSE_MIN) parts.push(`${p.waiting} people are queuing${p.topArea ? ` near ${p.topArea}` : ""}`);
  if (p.squads > 0) parts.push(`${p.squads} squad${p.squads === 1 ? " is" : "s are"} going`);
  return parts.join(" · ") || null;
}
