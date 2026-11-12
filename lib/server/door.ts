import { Frame, type Spotted } from "@/contracts";
import { matchFrame } from "@/lib/door/recognition";
import { publish } from "./bus";
import { nextId, nowIso, profile, store } from "./store";
import { postMessage } from "./social";
import { flag } from "@/lib/flags";

function lockedParty(partyId: string, viewerId: string) {
  const party = store().parties.get(partyId);
  if (!party || !party.memberIds.includes(viewerId)) throw new Error("not in this party");
  if (party.status !== "locked") throw new Error("party is not locked yet");
  return party;
}

/** "I'm here": tells the rest of the party. */
export function arrive(partyId: string, userId: string) {
  const party = lockedParty(partyId, userId);
  const s = store();
  if (!s.arrivals.has(partyId)) s.arrivals.set(partyId, new Set());
  s.arrivals.get(partyId)!.add(userId);
  publish("member.arrived", { partyId, userId, at: nowIso() }, party.memberIds, { stage: true });
  // An "I'm here" ping in the party chat: a fact this person just created by tapping.
  if (flag("CHAT_LIFECYCLE") && party.chatId && s.chats.has(party.chatId)) {
    try {
      postMessage(party.chatId, null, `${profile(userId).firstName} is here.`, "system", [`arrival-${userId}`]);
    } catch {
      /* the chat may have closed after the event */
    }
  }
}

/** A frame from the viewer's door camera. Only the viewer hears the result. */
export async function spotFromFrame(raw: unknown): Promise<Spotted> {
  const frame = Frame.parse(raw);
  const party = lockedParty(frame.partyId, frame.viewerId);
  const gallery = party.memberIds.filter((id) => id !== frame.viewerId).map((userId) => ({ userId }));
  const { subjectId } = await matchFrame(frame, gallery);
  const spotted: Spotted = { frameId: frame.id, viewerId: frame.viewerId, partyId: party.id, subjectId, method: frame.source === "recorded" ? "recorded" : "stub", at: nowIso() };
  store().spotted.push(spotted);
  publish("member.spotted", spotted, [frame.viewerId]);
  return spotted;
}

/** Tap a face: the viewer picks who is in front of them. */
export function spotByTap(partyId: string, viewerId: string, subjectId: string): Spotted {
  const party = lockedParty(partyId, viewerId);
  if (!party.memberIds.includes(subjectId) || subjectId === viewerId) throw new Error("not someone in your party");
  const spotted: Spotted = { frameId: nextId("tap"), viewerId, partyId, subjectId, method: "tap", at: nowIso() };
  store().spotted.push(spotted);
  publish("member.spotted", spotted, [viewerId]);
  return spotted;
}
