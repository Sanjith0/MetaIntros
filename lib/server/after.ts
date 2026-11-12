import type { Fact, MutualPair, Profile } from "@/contracts";
import { publish } from "./bus";
import { flag } from "@/lib/flags";
import { postMessage } from "./social";
import { nowIso, profile, store } from "./store";

/* ------------------------------ Run it back ------------------------------ */

/** Save one person's private picks. Picks are never shown to anyone; only a
 *  mutual pick becomes visible, and only to the two people in it. */
export function submitPicks(partyId: string, pickerId: string, pickedIds: string[]): MutualPair[] {
  const s = store();
  const party = s.parties.get(partyId);
  if (!party || !party.memberIds.includes(pickerId)) throw new Error("not in this party");
  if (party.status !== "locked") throw new Error("the night hasn't happened yet");
  const clean = [...new Set(pickedIds)].filter((id) => id !== pickerId && party.memberIds.includes(id));
  s.picks = s.picks.filter((p) => !(p.partyId === partyId && p.pickerId === pickerId));
  s.picks.push({ partyId, pickerId, pickedIds: clean, at: nowIso() });

  const fresh: MutualPair[] = [];
  for (const other of clean) {
    const theirs = s.picks.find((p) => p.partyId === partyId && p.pickerId === other);
    if (!theirs?.pickedIds.includes(pickerId)) continue;
    const [a, b] = pickerId < other ? [pickerId, other] : [other, pickerId];
    if (s.mutuals.some((m) => m.partyId === partyId && m.a === a && m.b === b)) continue;
    const pair: MutualPair = { partyId, a, b, revealedAt: nowIso() };
    s.mutuals.push(pair);
    fresh.push(pair);
    publish("runitback.mutual", pair, [a, b]);
  }
  if (fresh.length) updateStanding(partyId);
  // A pick that is withdrawn takes its mutual pair with it.
  s.mutuals = s.mutuals.filter((m) => {
    if (m.partyId !== partyId) return true;
    const pa = s.picks.find((p) => p.partyId === partyId && p.pickerId === m.a);
    const pb = s.picks.find((p) => p.partyId === partyId && p.pickerId === m.b);
    return !!pa?.pickedIds.includes(m.b) && !!pb?.pickedIds.includes(m.a);
  });
  return fresh;
}

/**
 * The card everyone without a match sees. A constant, so it can never vary
 * with whether anyone picked you, how many, or when.
 */
export const QUEUE_AGAIN_CARD = {
  title: "Queue again",
  body: "No mutual picks this time. That's normal, and nobody learns who picked whom. Your next five are a sentence away.",
  cta: "Find another party",
  href: "/events",
} as const;

/** The largest group (3 or more) in which every pair picked each other. */
export function largestMutualGroup(members: string[], isMutual: (a: string, b: string) => boolean): string[] {
  const n = members.length;
  let best: string[] = [];
  for (let mask = 1; mask < 1 << n; mask++) {
    const group = members.filter((_, i) => mask & (1 << i));
    if (group.length < 3 || group.length <= best.length) continue;
    let ok = true;
    for (let i = 0; ok && i < group.length; i++) for (let j = i + 1; ok && j < group.length; j++) if (!isMutual(group[i]!, group[j]!)) ok = false;
    if (ok) best = group;
  }
  return best;
}

function updateStanding(partyId: string) {
  if (!flag("RUN_IT_BACK_PLUS")) return;
  const s = store();
  const party = s.parties.get(partyId)!;
  const mutual = (a: string, b: string) => s.mutuals.some((m) => m.partyId === partyId && ((m.a === a && m.b === b) || (m.a === b && m.b === a)));
  const group = largestMutualGroup(party.memberIds, mutual);
  const existing = s.standing.get(partyId);
  if (group.length < 3) return;
  if (existing && group.every((id) => existing.memberIds.includes(id))) return;
  const chatId = existing?.chatId ?? `chat-standing-${partyId}`;
  const names = group.map((id) => profile(id).firstName);
  if (!s.chats.has(chatId)) {
    s.chats.set(chatId, { id: chatId, partyId: null, title: `Standing party · ${names.join(", ")}`, memberIds: group, pinnedMessageId: null, expiresAt: null });
  } else {
    const chat = s.chats.get(chatId)!;
    chat.memberIds = group;
    chat.title = `Standing party · ${names.join(", ")}`;
  }
  s.standing.set(partyId, { memberIds: group, chatId });
  postMessage(chatId, null, "You all picked each other. This is your standing party: this chat doesn't close.", "system", [`standing-${partyId}`]);
}

/** A private chat for one mutual pair. Only for a pair that both said yes. */
export function pairChat(partyId: string, viewerId: string, otherId: string): string {
  const s = store();
  const [a, b] = viewerId < otherId ? [viewerId, otherId] : [otherId, viewerId];
  if (!s.mutuals.some((m) => m.partyId === partyId && m.a === a && m.b === b)) throw new Error("only for a mutual pick");
  const chatId = `chat-rib-${partyId}-${a}-${b}`;
  if (!s.chats.has(chatId)) {
    s.chats.set(chatId, { id: chatId, partyId: null, title: `${profile(a).firstName} and ${profile(b).firstName}`, memberIds: [a, b], pinnedMessageId: null, expiresAt: null });
    postMessage(chatId, null, "You both said yes to running it back. Say hi.", "system", [`mutual-${partyId}-${a}-${b}`]);
  }
  return chatId;
}

/** What the viewer may see: their own picks and their own mutual pairs. */
export function runItBackView(partyId: string, viewerId: string) {
  const s = store();
  const party = s.parties.get(partyId);
  if (!party || !party.memberIds.includes(viewerId)) return null;
  const mine = s.picks.find((p) => p.partyId === partyId && p.pickerId === viewerId);
  const mutual = s.mutuals.filter((m) => m.partyId === partyId && (m.a === viewerId || m.b === viewerId)).map((m) => (m.a === viewerId ? m.b : m.a));
  const standing = s.standing.get(partyId);
  return {
    partyId,
    submitted: !!mine,
    myPicks: mine?.pickedIds ?? [],
    mutual,
    standing: standing?.memberIds.includes(viewerId) ? standing : null,
    // Everyone without a match gets the very same card.
    queueAgain: flag("RUN_IT_BACK_PLUS") && mine && mutual.length === 0 ? QUEUE_AGAIN_CARD : null,
  };
}

/* --------------------------------- Fair --------------------------------- */

export const FAIR_GROUP_ID = "grp-fair";
export const FAIR_EVENT_ID = "evt-lake-games";

export interface FairJoin {
  firstName: string;
  age: number;
  gender: Profile["gender"];
  pronouns: string;
  facts: { tag: string; text: string; ask: string; approved: boolean }[];
  consent: boolean;
}

/** A typed profile from the fair QR. Everyone who scans joins the fair's
 *  own small Group, which is their bridge to each other. */
export function createFairProfile(input: FairJoin): Profile {
  if (!input.consent) throw new Error("Consent is required to join.");
  if (input.age < 18) throw new Error("Party Queue is for people 18 and over.");
  const s = store();
  const n = [...s.profiles.keys()].filter((k) => k.startsWith("fair-")).length + 1;
  const id = `fair-${n}`;
  const facts: Fact[] = input.facts
    .filter((f) => f.text.trim())
    .slice(0, 3)
    .map((f, i) => ({
      id: `${id}-f${i + 1}`,
      ownerId: id,
      tag: f.tag.trim().toLowerCase().slice(0, 40) || "fair",
      text: f.text.trim().slice(0, 120),
      ask: (f.ask.trim() || `Tell me about ${f.tag.trim() || "that"}?`).slice(0, 120),
      approved: f.approved,
      source: "fair",
    }));
  const p: Profile = {
    id,
    name: `${input.firstName.trim()} (fair guest)`,
    firstName: input.firstName.trim(),
    age: input.age,
    gender: input.gender,
    pronouns: input.pronouns.trim() || "they/them",
    city: "Oakland",
    homeLandmark: "Lake Merritt",
    avatarHue: (n * 67) % 360,
    facts,
    settings: { womenOnly: false, notOnlyWoman: false },
    blocks: [],
    groupIds: [FAIR_GROUP_ID],
  };
  s.profiles.set(id, p);
  return p;
}

export function fairGroupSize(): number {
  return [...store().profiles.values()].filter((p) => p.groupIds.includes(FAIR_GROUP_ID)).length;
}
