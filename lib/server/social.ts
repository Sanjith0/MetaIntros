import type { ChatMessage, EventItem, Party } from "@/contracts";
import { friendsOf } from "@/lib/graph";
import { publish } from "./bus";
import { demoNow } from "./clock";
import { nextId, nowIso, profile, store, type Rsvp } from "./store";

/* ------------------------------- RSVPs -------------------------------- */

export function setRsvp(eventId: string, userId: string, status: Rsvp | null) {
  const s = store();
  if (!s.events.has(eventId)) throw new Error("unknown event");
  if (!s.rsvps.has(eventId)) s.rsvps.set(eventId, new Map());
  const m = s.rsvps.get(eventId)!;
  if (status) m.set(userId, status);
  else m.delete(userId);
}

export interface Person {
  id: string;
  name: string;
  firstName: string;
  hue: number;
}
export const person = (id: string): Person => {
  const p = profile(id);
  return { id: p.id, name: p.name, firstName: p.firstName, hue: p.avatarHue };
};

export interface EventView {
  event: EventItem;
  interested: number;
  going: number;
  viewerRsvp: Rsvp | null;
  goingPeople: Person[];
  interestedPeople: Person[];
  friendsGoing: Person[];
  party: { id: string; status: Party["status"]; members: Person[]; planHere: boolean } | null;
}

export function partyForViewer(viewerId: string): Party | null {
  const s = store();
  // A party someone left before the lock is gone for everyone in it.
  const parties = [...s.parties.values()].filter((p) => p.memberIds.includes(viewerId) && !s.operator.cancelled.has(p.id));
  return parties.at(-1) ?? null;
}

export function eventView(eventId: string, viewerId: string): EventView | null {
  const s = store();
  const event = s.events.get(eventId);
  if (!event) return null;
  const r = s.rsvps.get(eventId) ?? new Map<string, Rsvp>();
  const goingIds = [...r].filter(([, v]) => v === "going").map(([k]) => k);
  const interestedIds = [...r].filter(([, v]) => v === "interested").map(([k]) => k);
  const friends = friendsOf(viewerId);
  const party = partyForViewer(viewerId);
  const plan = party?.planId ? s.plans.get(party.planId) : undefined;
  return {
    event,
    interested: event.interested + interestedIds.length,
    going: event.going + goingIds.length,
    viewerRsvp: r.get(viewerId) ?? null,
    goingPeople: goingIds.map(person),
    interestedPeople: interestedIds.map(person),
    friendsGoing: goingIds.filter((id) => friends.has(id)).map(person),
    party: party
      ? { id: party.id, status: party.status, members: party.memberIds.map(person), planHere: plan?.eventId === eventId }
      : null,
  };
}

/* -------------------------------- Chat -------------------------------- */

export function chatsFor(viewerId: string) {
  const s = store();
  return [...s.chats.values()]
    .filter((c) => c.memberIds.includes(viewerId))
    .map((c) => {
      const msgs = s.messages.filter((m) => m.chatId === c.id);
      return { chat: c, last: msgs.at(-1) ?? null };
    })
    .sort((a, b) => (b.last?.at ?? "").localeCompare(a.last?.at ?? ""));
}

/** After the event, a party chat closes: its messages are deleted and it is read-only. */
export function expireIfDue(chatId: string): boolean {
  const s = store();
  const chat = s.chats.get(chatId);
  if (!chat?.expiresAt || demoNow() < Date.parse(chat.expiresAt)) return false;
  s.messages = s.messages.filter((m) => m.chatId !== chatId);
  chat.pinnedMessageId = null;
  return true;
}

export function chatView(chatId: string, viewerId: string) {
  const s = store();
  const chat = s.chats.get(chatId);
  if (!chat || !chat.memberIds.includes(viewerId)) return null;
  if (expireIfDue(chatId)) return { chat, messages: [], pinned: null, members: chat.memberIds.map(person), expired: true };
  const messages = s.messages.filter((m) => m.chatId === chatId);
  const pinned = chat.pinnedMessageId ? messages.find((m) => m.id === chat.pinnedMessageId) ?? null : null;
  return { chat, messages, pinned, members: chat.memberIds.map(person), expired: false };
}

export function postMessage(
  chatId: string,
  senderId: string | null,
  text: string,
  kind: ChatMessage["kind"] = "user",
  sourceIds: string[] = [],
): ChatMessage {
  const s = store();
  const chat = s.chats.get(chatId);
  if (!chat) throw new Error("unknown chat");
  if (senderId && !chat.memberIds.includes(senderId)) throw new Error("not a member");
  if (expireIfDue(chatId)) throw new Error("This chat closed after the event.");
  const msg: ChatMessage = { id: nextId("m"), chatId, senderId, kind, text, sourceIds, at: nowIso() };
  s.messages.push(msg);
  if (kind === "pinned") chat.pinnedMessageId = msg.id;
  publish("chat.message", msg, chat.memberIds);
  return msg;
}
