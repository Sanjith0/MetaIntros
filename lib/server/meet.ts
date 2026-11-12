import { flag } from "@/lib/flags";
import { publish } from "./bus";
import { postMessage } from "./social";
import { profile, store } from "./store";

/**
 * Finding each other at the venue (F37). Two things a party member can
 * choose to tell the other four: "running late" (10, 20 or 30 minutes), and
 * where to meet ("by the big fountain, blue jacket"). Each goes to the party
 * chat as their own message and to everyone's door screen. Arriving clears
 * "late".
 */
export const LATE_CHOICES = [10, 20, 30] as const;
export const MAX_SPOT = 80;

export interface DoorState {
  late: Record<string, number>;
  meet: { text: string; by: string; byName: string } | null;
}

function party(partyId: string, userId: string) {
  if (!flag("FIND_EACH_OTHER")) throw new Error("turned off");
  const p = store().parties.get(partyId);
  if (!p || !p.memberIds.includes(userId)) throw new Error("not in this party");
  if (p.status !== "locked") throw new Error("Your plan isn't set yet.");
  return p;
}

const state = (partyId: string) => {
  const s = store();
  if (!s.door.has(partyId)) s.door.set(partyId, { late: {}, meet: null });
  return s.door.get(partyId)!;
};

function say(chatId: string | null, userId: string, text: string) {
  if (!chatId || !store().chats.has(chatId)) return;
  try {
    postMessage(chatId, userId, text, "user");
  } catch {
    /* the chat may have closed after the event */
  }
}

export function runningLate(partyId: string, userId: string, minutes: number) {
  const p = party(partyId, userId);
  if (!(LATE_CHOICES as readonly number[]).includes(minutes)) throw new Error("Pick 10, 20 or 30 minutes.");
  state(partyId).late[userId] = minutes;
  say(p.chatId, userId, `Running about ${minutes} minutes late.`);
  publish("door.update", { partyId, userId, lateMinutes: minutes, meetSpot: null }, p.memberIds);
}

export function setMeetSpot(partyId: string, userId: string, text: string) {
  const p = party(partyId, userId);
  const spot = text.replace(/\s+/g, " ").trim();
  if (spot.length < 3 || spot.length > MAX_SPOT) throw new Error(`Say where in 3 to ${MAX_SPOT} characters.`);
  state(partyId).meet = { text: spot, by: userId };
  say(p.chatId, userId, `Let's meet: ${spot}`);
  publish("door.update", { partyId, userId, lateMinutes: null, meetSpot: spot }, p.memberIds);
}

/** Called when someone arrives: they're not late any more. */
export function clearLate(partyId: string, userId: string) {
  const d = store().door.get(partyId);
  if (d) delete d.late[userId];
}

export function doorState(partyId: string): DoorState {
  const d = store().door.get(partyId) ?? { late: {}, meet: null };
  return { late: { ...d.late }, meet: d.meet ? { ...d.meet, byName: profile(d.meet.by).firstName } : null };
}
