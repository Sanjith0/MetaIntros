import { TOPICS } from "@/fixtures/topics";
import { createFairProfile, FAIR_EVENT_ID, FAIR_GROUP_ID } from "./after";
import { arrive } from "./door";
import { joinQueue } from "./queue";
import { store } from "./store";

/**
 * Fair mode: what the host sees. Counts only, never names: how many guests
 * joined, how many are waiting, how many parties formed and locked, and how
 * many people met at the door.
 */
export interface FairStats {
  guests: number;
  queued: number;
  parties: number;
  locked: number;
  met: number;
  partiesMet: number;
}

const isFairGuest = (id: string) => store().profiles.get(id)?.groupIds.includes(FAIR_GROUP_ID) ?? false;

export function fairStats(): FairStats {
  const s = store();
  const guests = [...s.profiles.values()].filter((p) => p.groupIds.includes(FAIR_GROUP_ID)).length;
  const queued = s.queue.filter((q) => q.status === "waiting" && isFairGuest(q.userId)).length;
  const parties = [...s.parties.values()].filter((p) => p.memberIds.some(isFairGuest) && !s.operator.cancelled.has(p.id));
  const locked = parties.filter((p) => p.status === "locked");
  let met = 0;
  let partiesMet = 0;
  for (const p of locked) {
    const here = s.arrivals.get(p.id)?.size ?? 0;
    met += here;
    if (here >= 2) partiesMet++;
  }
  return { guests, queued, parties: parties.length, locked: locked.length, met, partiesMet };
}

/* ---------------------- simulated guests (demo only) ---------------------- */

const FIRST = ["Avery", "Blake", "Casey", "Drew", "Emery", "Finley", "Harper", "Indigo", "Jordan", "Kendall", "Logan", "Morgan", "Noel", "Parker", "Quinn", "Reese", "Rowan", "Sage", "Taylor", "Winter"];
const SENTENCES = [
  "board games or anything chill, home by ten",
  "something outside, budget of 10",
  "meet new people somewhere public, out by 10",
  "trivia or board games, leave by eleven",
  "cheap and cheerful, under ten bucks",
];
const TAGS = Object.keys(TOPICS);

/** Fictional guests "scan the QR" and join, so the host screen has something to count. */
export async function simulateGuests(n: number): Promise<number> {
  const s = store();
  const start = [...s.profiles.keys()].filter((k) => k.startsWith("fair-")).length;
  for (let i = 0; i < n; i++) {
    const k = start + i;
    const t1 = TAGS[(k * 3) % TAGS.length]!;
    const t2 = TAGS[(k * 7 + 1) % TAGS.length]!;
    const p = createFairProfile({
      firstName: `${FIRST[k % FIRST.length]}`,
      age: 21 + ((k * 5) % 19),
      gender: (["woman", "man", "nonbinary"] as const)[k % 3]!,
      pronouns: "",
      facts: [
        { tag: t1, text: TOPICS[t1]!.text, ask: TOPICS[t1]!.ask, approved: true },
        { tag: t2, text: TOPICS[t2]!.text, ask: TOPICS[t2]!.ask, approved: true },
      ],
      consent: true,
    });
    await joinQueue({ userId: p.id, eventId: FAIR_EVENT_ID, sentence: SENTENCES[k % SENTENCES.length]!, consentBridges: true });
  }
  return n;
}

/** Everyone in a locked fair party taps "I'm here". */
export function simulateArrivals(): number {
  const s = store();
  let n = 0;
  for (const p of s.parties.values()) {
    if (p.status !== "locked" || !p.memberIds.some(isFairGuest)) continue;
    for (const id of p.memberIds) {
      if (s.arrivals.get(p.id)?.has(id)) continue;
      arrive(p.id, id);
      n++;
    }
  }
  return n;
}
