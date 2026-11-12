import type { Fact, MutualPair, Profile } from "@/contracts";
import { publish } from "./bus";
import { nowIso, store } from "./store";

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
  // A pick that is withdrawn takes its mutual pair with it.
  s.mutuals = s.mutuals.filter((m) => {
    if (m.partyId !== partyId) return true;
    const pa = s.picks.find((p) => p.partyId === partyId && p.pickerId === m.a);
    const pb = s.picks.find((p) => p.partyId === partyId && p.pickerId === m.b);
    return !!pa?.pickedIds.includes(m.b) && !!pb?.pickedIds.includes(m.a);
  });
  return fresh;
}

/** What the viewer may see: their own picks and their own mutual pairs. */
export function runItBackView(partyId: string, viewerId: string) {
  const s = store();
  const party = s.parties.get(partyId);
  if (!party || !party.memberIds.includes(viewerId)) return null;
  const mine = s.picks.find((p) => p.partyId === partyId && p.pickerId === viewerId);
  return {
    partyId,
    submitted: !!mine,
    myPicks: mine?.pickedIds ?? [],
    mutual: s.mutuals.filter((m) => m.partyId === partyId && (m.a === viewerId || m.b === viewerId)).map((m) => (m.a === viewerId ? m.b : m.a)),
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
