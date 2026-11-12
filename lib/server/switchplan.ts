import { flag } from "@/lib/flags";
import { clock12, dayLabel, price } from "@/lib/format";
import { publish } from "./bus";
import { planB } from "./planb";
import { postMessage, setRsvp } from "./social";
import { store } from "./store";
import { trace } from "./trace";

/**
 * Switch to plan B (F54). Any member can ask, from their own phone. When
 * three of the five have asked, code moves the party to plan B: the RSVPs,
 * the pinned plan in the chat, the party card. The chat only ever says how
 * many asked, never who.
 */
export const SWITCH_VOTES = 3;

export interface SwitchState {
  votes: number;
  needed: number;
  mine: boolean;
}

const votesOf = (partyId: string) => {
  const s = store();
  if (!s.switchVotes.has(partyId)) s.switchVotes.set(partyId, new Set());
  return s.switchVotes.get(partyId)!;
};

export function switchState(partyId: string, userId: string): SwitchState | null {
  if (!flag("PLAN_B_SWITCH") || !planB(partyId)) return null;
  const v = votesOf(partyId);
  return { votes: v.size, needed: SWITCH_VOTES, mine: v.has(userId) };
}

export function askToSwitch(partyId: string, userId: string): { switched: boolean; state: SwitchState | null } {
  if (!flag("PLAN_B_SWITCH")) throw new Error("turned off");
  const s = store();
  const party = s.parties.get(partyId);
  if (!party || !party.memberIds.includes(userId)) throw new Error("not in this party");
  const backup = planB(partyId);
  if (party.status !== "locked" || !party.planId || !backup) throw new Error("There's no plan B to switch to.");
  const v = votesOf(partyId);
  if (v.has(userId)) throw new Error("You already asked.");
  v.add(userId);
  const chatId = party.chatId && s.chats.has(party.chatId) ? party.chatId : null;
  if (v.size < SWITCH_VOTES) {
    if (chatId) postMessage(chatId, null, `${v.size} of ${SWITCH_VOTES} needed asked to switch to plan B: ${backup.title}.`, "system");
    return { switched: false, state: switchState(partyId, userId) };
  }

  // Switch.
  const from = s.plans.get(party.planId)!;
  const to = s.plans.get(backup.planId)!;
  party.planId = to.id;
  for (const id of party.memberIds) {
    setRsvp(from.eventId, id, null);
    setRsvp(to.eventId, id, "going");
  }
  v.clear();
  if (chatId) {
    s.chats.get(chatId)!.title = `${to.title} · party of 5`;
    postMessage(chatId, null, `Switched to plan B: ${SWITCH_VOTES} of 5 asked. Your RSVP moved.`, "system");
    postMessage(chatId, null, `${to.title} · ${dayLabel(to.date)}, ${clock12(to.start)}–${clock12(to.end)} · ${to.venueName} · ${price(to.priceUsd)}`, "pinned", [to.id]);
  }
  trace(partyId, "shared", "judge", null, "Switched to plan B", `${to.title} · ${SWITCH_VOTES} of 5 asked · it fits everyone's rules`, { tone: "lock", meta: { kind: "switched", planId: to.id } });
  publish("party.switched", { partyId }, party.memberIds, { stage: true });
  return { switched: true, state: switchState(partyId, userId) };
}
