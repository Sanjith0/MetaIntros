import { store } from "./store";

/**
 * "Add to calendar" (F38): the locked plan as an iCalendar file. Local
 * (San Francisco) times, a plan that ends after midnight ends the next day,
 * and it names nobody: "With four people you met through Party Queue".
 */
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const stamp = (date: string, hhmm: string) => `${date.replace(/-/g, "")}T${hhmm.replace(":", "")}00`;
const nextDay = (date: string) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function partyIcs(partyId: string, viewerId: string, now: Date = new Date()): { filename: string; body: string } | null {
  const s = store();
  const party = s.parties.get(partyId);
  if (!party || party.status !== "locked" || !party.planId || !party.memberIds.includes(viewerId)) return null;
  const plan = s.plans.get(party.planId)!;
  const ev = s.events.get(plan.eventId);
  if (!ev) return null;
  const endDate = plan.end < plan.start ? nextDay(ev.date) : ev.date;
  const others = party.memberIds.length - 1;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Party Queue//Hackathon prototype//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${party.id}-${viewerId}@party-queue.invalid`,
    `DTSTAMP:${now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`,
    `DTSTART;TZID=America/Los_Angeles:${stamp(ev.date, plan.start)}`,
    `DTEND;TZID=America/Los_Angeles:${stamp(endDate, plan.end)}`,
    `SUMMARY:${esc(plan.title)}`,
    `LOCATION:${esc(`${plan.venueName}, ${ev.landmark}`)}`,
    `DESCRIPTION:${esc(`With ${others === 4 ? "four" : others} people you met through Party Queue. Your group chat has the plan pinned. Hackathon prototype: fictional data.`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return { filename: `party-queue-${slug(plan.title)}.ics`, body: lines.join("\r\n") + "\r\n" };
}
