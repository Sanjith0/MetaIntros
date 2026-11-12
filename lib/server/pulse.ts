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

/**
 * F55: what Party Queue brings to an event, for its page and its organiser:
 * parties of five coming here (their locked plan is this event) and how many
 * of those people have tapped "I'm here". Whole parties only, so no count
 * can point at one person.
 */
export function eventImpact(eventId: string): { text: string; parties: number; people: number; here: number } | null {
  if (!flag("EVENT_IMPACT")) return null;
  const s = store();
  const coming = [...s.parties.values()].filter((p) => p.status === "locked" && p.planId && s.plans.get(p.planId)?.eventId === eventId);
  if (!coming.length) return null;
  const people = coming.reduce((n, p) => n + p.memberIds.length, 0);
  const here = coming.reduce((n, p) => n + [...(s.arrivals.get(p.id) ?? [])].filter((id) => p.memberIds.includes(id)).length, 0);
  const parties = coming.length;
  const text = `Party Queue: ${parties === 1 ? "1 party of five is" : `${parties} parties (${people} people) are`} coming tonight${here ? ` · ${here} already here` : ""}.`;
  return { text, parties, people, here };
}

export function queuePulse(eventId: string, viewerId: string, opts: { omitFormed?: boolean } = {}): { text: string; waiting: number; parties: number } | null {
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
  const formed = parties && !opts.omitFormed ? ` ${parties} ${parties === 1 ? "party has" : "parties have"} formed here.` : "";
  return { text: who + formed, waiting, parties };
}
