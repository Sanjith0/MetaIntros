import type { Verdict } from "@/contracts";
import { ownerChecks, partyChecks } from "@/lib/agents/judge";
import { onePair, openerText } from "@/lib/agents/pair";
import { preferenceFor } from "@/lib/agents/agent";
import { cardsForPair } from "@/lib/agents/orchestrator";
import { flag } from "@/lib/flags";
import { clock12 } from "@/lib/format";
import { checkParty, type Candidate } from "@/lib/queue/formation";
import { publish } from "./bus";
import { sameBucket, setKey } from "./queue";
import { postMessage, setRsvp } from "./social";
import { factById, profile, store } from "./store";
import { trace } from "./trace";

/**
 * "Can't make it" after the lock (F42). The plan stands. Code looks for
 * someone waiting nearby whose own rules pass the locked plan and who fits
 * every formation rule with the other four (a tie, blocks, 18+, women-only
 * settings). If there is one, they take the seat: their agent meets each of
 * the four in pair talk, so they get cards and an opener like everyone else.
 * The others are told only that one person couldn't make it, never who.
 */
export interface RefillResult {
  partyId: string;
  joined: string | null;
}

export async function cantMakeIt(partyId: string, userId: string): Promise<RefillResult> {
  if (!flag("SEAT_REFILL")) throw new Error("turned off");
  const s = store();
  const party = s.parties.get(partyId);
  if (!party || !party.memberIds.includes(userId)) throw new Error("not in this party");
  if (party.status !== "locked" || !party.planId) throw new Error("Your plan isn't set yet: you can leave the party instead.");
  if (s.arrivals.get(partyId)?.has(userId)) throw new Error("You're already there.");
  if (s.dropped.has(`${partyId}:${userId}`)) throw new Error("You already said you can't make it.");
  const plan = s.plans.get(party.planId)!;
  const remaining = party.memberIds.filter((id) => id !== userId);
  const entryOf = (id: string) => [...s.queue].reverse().find((e) => e.userId === id);
  const anchor = entryOf(remaining[0]!)!;

  // The leaver: not going, out of the queue entry.
  setRsvp(plan.eventId, userId, null);
  const leaverEntry = entryOf(userId);
  if (leaverEntry) leaverEntry.status = "left";

  // Who could take the seat: waiting nearby, rules pass the plan, a valid party with the four.
  const candidates = s.queue
    .filter((e) => e.status === "waiting" && !party.memberIds.includes(e.userId) && sameBucket(e, anchor))
    .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));
  let joined: string | null = null;
  for (const e of candidates) {
    const brief = s.briefs.get(e.briefId);
    if (!brief || !partyChecks(partyId, plan).every((c) => c.pass) || !ownerChecks(partyId, plan, brief).every((c) => c.pass)) continue;
    const five: Candidate[] = [...remaining.map((id) => ({ entry: entryOf(id)!, profile: profile(id) })), { entry: e, profile: profile(e.userId) }];
    if (checkParty(five, (id) => profile(id).name).length) continue;
    if (s.avoidSets.has(setKey(five.map((c) => c.profile.id)))) continue;
    joined = e.userId;
    e.status = "matched";
    break;
  }

  const chatId = party.chatId;
  if (!joined) {
    s.dropped.add(`${partyId}:${userId}`);
    if (chatId && s.chats.has(chatId)) postMessage(chatId, null, "One person can't make it. The plan stands.", "system");
    trace(partyId, "shared", "judge", null, "Seat open", "One person can't make it. Nobody waiting nearby fits the plan and the party, so the plan stands for four.", { tone: "neutral", meta: { kind: "seat" } });
    publish("party.seat", { partyId, refilled: false }, remaining, { stage: true });
    return { partyId, joined: null };
  }

  // The newcomer takes the seat.
  const slot = party.memberIds.indexOf(userId);
  party.memberIds[slot] = joined;
  party.signatures = party.signatures.map((id) => (id === userId ? joined! : id));
  setRsvp(plan.eventId, joined, "going");
  const brief = s.briefs.get(`brief-${joined}`)!;
  const verdict: Verdict = {
    partyId,
    ownerId: joined,
    round: 1,
    planId: plan.id,
    decision: "accept",
    preference: preferenceFor(brief, plan),
    privateReason: "Fits your rules. You took an open seat on a plan that was already set.",
    overriddenByCode: false,
  };
  s.verdicts.push(verdict);

  // Cards: drop the leaver's, then pair talk between the newcomer and each of the four.
  s.cards = s.cards.filter((c) => !(c.partyId === partyId && (c.viewerId === userId || c.subjectId === userId)));
  const pairs = [];
  for (const m of remaining) {
    const pr = await onePair(party, m, joined, () => 0);
    pairs.push(pr);
    s.cards.push(...cardsForPair(party, pr));
  }

  // The chat: the newcomer in, the leaver out; one line that names nobody who left, and the newcomer's opener.
  const chat = chatId ? s.chats.get(chatId) : undefined;
  if (chat) {
    chat.memberIds = chat.memberIds.map((id) => (id === userId ? joined! : id));
    postMessage(chat.id, null, `One person couldn't make it. ${profile(joined).firstName} is taking the seat.`, "system");
    const to = remaining[0]!;
    const pr = pairs.find((p) => p.a === joined || p.b === joined)!;
    const opener = pr.openers[joined];
    const fact = opener ? factById(opener.sourceIds[0]!) : undefined;
    if (opener && fact) postMessage(chat.id, joined, openerText(profile(to), fact), "opener", opener.sourceIds);
  }

  trace(partyId, "shared", "judge", null, "Seat refilled", `One person couldn't make it. Code found someone waiting nearby whose rules pass ${plan.title} and who fits the party; their agent met the other four.`, {
    tone: "sign",
    meta: { kind: "seat" },
  });
  publish("party.seat", { partyId, refilled: true }, remaining, { stage: true });
  publish(
    "match.found",
    { partyId, planId: plan.id, eventId: plan.eventId, title: plan.title, venueName: plan.venueName, start: clock12(plan.start), chatId: chatId ?? "", lockedAt: party.lockedAt ?? new Date().toISOString() },
    [joined],
    { stage: true },
  );
  return { partyId, joined };
}

export const hasDropped = (partyId: string, userId: string) => store().dropped.has(`${partyId}:${userId}`);
