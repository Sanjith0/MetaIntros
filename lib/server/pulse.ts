import { flag } from "@/lib/flags";
import { nightOf } from "@/lib/queue/formation";
import { store } from "./store";

/**
 * Queue pulse (F51): on an Event page, how many people are waiting near
 * this place tonight, and how many parties have formed here. Counts only,
 * never names; and under three waiting it says "a few" rather than a
 * number, so a count can't single anyone out.
 */
export const PULSE_FLOOR = 3;

export function queuePulse(eventId: string, viewerId: string): { text: string; waiting: number; parties: number } | null {
  if (!flag("QUEUE_PULSE")) return null;
  const s = store();
  const ev = s.events.get(eventId);
  if (!ev || !ev.partyEligible) return null;
  const night = ev.date;
  const waiting = s.queue.filter((e) => e.status === "waiting" && e.userId !== viewerId && nightOf(e) === night && (e.scope === "night" || e.landmark === ev.landmark)).length;
  const parties = [...s.parties.values()].filter((p) => {
    const pe = p.eventId ? s.events.get(p.eventId) : undefined;
    return pe && pe.landmark === ev.landmark && pe.date === night && p.status !== "failed";
  }).length;
  const who = waiting === 0 ? `Be the first in the queue near ${ev.landmark} tonight.` : waiting < PULSE_FLOOR ? `A few people are waiting near ${ev.landmark} tonight.` : `${waiting} people are waiting near ${ev.landmark} tonight.`;
  const formed = parties ? ` ${parties} ${parties === 1 ? "party has" : "parties have"} formed here.` : "";
  return { text: who + formed, waiting, parties };
}
