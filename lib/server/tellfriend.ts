import { clock12, dayLabel } from "@/lib/format";
import { store } from "./store";

/**
 * "Tell a friend where you'll be" (F36). A message to send someone outside
 * the app before you meet four new people: the place, the time, and when
 * you'll check in. It never names the others (they didn't agree to be
 * named to strangers) and says nothing about anyone's rules. The app sends
 * nothing itself; you copy it or share it.
 */
export const CHECK_IN_AFTER = [30, 60, 120] as const;

const addMinutes = (hhmm: string, mins: number) => {
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  const t = (h * 60 + m + mins) % (24 * 60);
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

export interface FriendMessage {
  /** One version per check-in choice, minutes after the plan ends. */
  options: { after: number; checkInBy: string; text: string }[];
}

export function friendMessage(partyId: string, viewerId: string): FriendMessage | null {
  const s = store();
  const party = s.parties.get(partyId);
  if (!party || party.status !== "locked" || !party.planId || !party.memberIds.includes(viewerId)) return null;
  const plan = s.plans.get(party.planId)!;
  const ev = s.events.get(plan.eventId);
  const day = ev ? dayLabel(ev.date) : "";
  const others = party.memberIds.length - 1;
  return {
    options: CHECK_IN_AFTER.map((after) => {
      const by = clock12(addMinutes(plan.end, after));
      return {
        after,
        checkInBy: by,
        text: `Heads up: I'm going to ${plan.title} at ${plan.venueName}, ${day}, ${clock12(plan.start)}–${clock12(plan.end)}, with ${others === 4 ? "four" : others} people I met through Party Queue. It's a public place. I'll text you by ${by}.`,
      };
    }),
  };
}
