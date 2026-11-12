import type { CandidatePlan, Party, QueueEntry } from "@/contracts";
import { EVENT_TAGS } from "@/fixtures";
import { buildBrief } from "@/lib/agents/brief";
import { runParty } from "@/lib/agents/orchestrator";
import { eligibleToQueue, formParty, bucketKey, PARTY_SIZE, type Candidate } from "@/lib/queue/formation";
import { areFriends } from "@/lib/graph";
import { publish } from "./bus";
import { nextId, nowIso, profile, store } from "./store";
import { trace } from "./trace";

export interface JoinInput {
  userId: string;
  eventId: string;
  sentence: string;
  consentBridges: boolean;
  approvedLineIds?: string[];
  /** Queue together with this friend (duo queue). */
  duoWith?: string | null;
  /** Saved to the profile: only all-women parties; never the only woman. */
  settings?: { womenOnly: boolean; notOnlyWoman: boolean };
  /** Start the agents' table talk when a party forms (off in some tests). */
  startTalk?: boolean;
}

export interface JoinResult {
  entry: QueueEntry;
  partyId: string | null;
}

/** The evening (or morning) window an event implies, in Pacific time. */
export function windowFor(date: string, start: string) {
  const morning = Number(start.slice(0, 2)) < 12;
  return morning
    ? { start: `${date}T08:00:00-08:00`, end: `${date}T13:00:00-08:00` }
    : { start: `${date}T18:00:00-08:00`, end: `${date}T23:59:00-08:00` };
}

export async function joinQueue(input: JoinInput): Promise<JoinResult> {
  const s = store();
  const p = profile(input.userId);
  const blocked = eligibleToQueue(p);
  if (blocked) throw new Error(blocked.detail);
  const event = s.events.get(input.eventId);
  if (!event) throw new Error("unknown event");
  if (!event.partyEligible) throw new Error("this event is not open to Party Queue");

  if (input.duoWith) {
    if (input.duoWith === input.userId) throw new Error("You can't queue with yourself.");
    const friend = s.profiles.get(input.duoWith);
    if (!friend || !areFriends(input.userId, input.duoWith)) throw new Error("You can only queue with a friend.");
    if (eligibleToQueue(friend)) throw new Error("Your friend can't join Party Queue.");
    if (p.blocks.includes(friend.id) || friend.blocks.includes(p.id)) throw new Error("You can't queue with that person.");
  }
  if (input.settings) p.settings = { ...p.settings, ...input.settings };

  // One active entry per person.
  for (const e of s.queue) if (e.userId === input.userId && e.status === "waiting") e.status = "left";

  const built = await buildBrief(input.userId, input.sentence.trim(), p.facts, input.approvedLineIds);
  s.briefs.set(built.brief.id, built.brief);
  for (const f of built.facts) s.briefFacts.set(f.id, f);

  const entry: QueueEntry = {
    id: nextId("q"),
    userId: input.userId,
    eventId: event.id,
    landmark: event.landmark,
    window: windowFor(event.date, event.start),
    briefId: built.brief.id,
    consentBridges: input.consentBridges,
    duoWith: input.duoWith ?? null,
    joinedAt: nowIso(),
    status: "waiting",
  };
  s.queue.push(entry);
  publish("queue.joined", { entryId: entry.id, userId: entry.userId, eventId: entry.eventId, landmark: entry.landmark }, [entry.userId]);
  // Duo: if the friend hasn't joined with us yet, invite them.
  if (entry.duoWith) {
    const theirs = s.queue.find((q) => q.userId === entry.duoWith && q.status === "waiting" && q.duoWith === entry.userId);
    if (!theirs) publish("queue.invite", { fromId: entry.userId, toId: entry.duoWith, eventId: event.id }, [entry.duoWith]);
  }
  ensureTicker();

  const partyId = await tryForm(entry.userId, input.startTalk ?? true);
  return { entry, partyId };
}

export function leaveQueue(userId: string) {
  for (const e of store().queue) if (e.userId === userId && e.status === "waiting") e.status = "left";
}

export function queueStatus(userId: string) {
  const s = store();
  const entry = [...s.queue].reverse().find((e) => e.userId === userId && e.status !== "left");
  if (!entry) return null;
  const inBucket = s.queue.filter((e) => e.status === "waiting" && bucketKey(e) === bucketKey(entry)).length;
  const party = [...s.parties.values()].reverse().find((p) => p.memberIds.includes(userId));
  const partner = entry.duoWith ? s.queue.find((q) => q.userId === entry.duoWith && q.status !== "left") : undefined;
  return {
    entry,
    duo: entry.duoWith ? { with: entry.duoWith, confirmed: !!partner && partner.duoWith === userId } : null,
    inBucket,
    needed: Math.max(0, PARTY_SIZE - inBucket),
    waitingSeconds: Math.round((Date.now() - Date.parse(entry.joinedAt)) / 1000),
    partyId: entry.status === "waiting" ? null : (party?.id ?? null),
  };
}

/* -------------------------------- forming -------------------------------- */

/** Try to form a party from whoever is waiting (after someone leaves, for example). */
export async function reform(startTalk = true): Promise<string | null> {
  return tryForm(undefined, startTalk);
}

async function tryForm(mustInclude: string | undefined, startTalk: boolean): Promise<string | null> {
  const s = store();
  const cands: Candidate[] = s.queue.filter((e) => e.status === "waiting").map((entry) => ({ entry, profile: profile(entry.userId) }));
  const formed = formParty(cands, { mustInclude, nameOf: (id) => profile(id).name });
  if (!formed) return null;

  const joiner = formed.members.find((m) => m.profile.id === mustInclude) ?? formed.members[0]!;
  const event = s.events.get(joiner.entry.eventId ?? "")!;
  const plans = candidatePlans(event.landmark, event.date);
  plans.forEach((pl) => s.plans.set(pl.id, pl));

  const party: Party = {
    id: nextId("party"),
    bucketId: `bucket-${bucketKey(joiner.entry).replace(/\s+/g, "-")}-${event.date}`,
    eventId: event.id,
    memberIds: formed.members.map((m) => m.profile.id),
    bridges: formed.bridges,
    candidatePlanIds: plans.map((p) => p.id),
    status: "forming",
    planId: null,
    lockedBy: null,
    signatures: [],
    chatId: null,
    formedAt: nowIso(),
    lockedAt: null,
  };
  s.parties.set(party.id, party);
  for (const m of formed.members) m.entry.status = "forming";

  trace(party.id, "shared", "formation", null, "Party formed", `Five people near ${event.landmark} on ${event.date}. Every member shares a mutual friend or a small Group with someone here.`, { meta: { kind: "formed" } });
  trace(
    party.id,
    "private",
    "formation",
    null,
    "Code checked the rules",
    `Same landmark bucket, a shared window of 90+ minutes, all 18+, no blocks, women-only and not-the-only-woman settings respected, ${formed.bridges.length} bridges found.`,
  );
  publish("party.forming", { partyId: party.id, memberIds: party.memberIds, landmark: event.landmark }, party.memberIds, { stage: true });

  if (startTalk) {
    void runParty(party.id).catch((err) => {
      trace(party.id, "private", "judge", null, "Talk crashed", String(err));
    });
  }
  return party.id;
}

/** Party-eligible events at the same landmark on the same day. */
export function candidatePlans(landmark: string, date: string): CandidatePlan[] {
  return [...store().events.values()]
    .filter((e) => e.partyEligible && e.landmark === landmark && e.date === date)
    .map((e) => ({
      id: `plan-${e.id}`,
      eventId: e.id,
      title: e.title,
      venueName: e.venueName,
      venueKind: e.venueKind,
      landmark: e.landmark,
      date: e.date,
      start: e.start,
      end: e.end,
      priceUsd: e.priceUsd,
      drinkMinimum: e.drinkMinimum,
      tags: EVENT_TAGS[e.id] ?? [],
      blurb: e.description.split(/(?<=\.)\s/)[0] ?? e.description,
    }));
}

/* --------------------------------- ticks --------------------------------- */

const g = globalThis as unknown as { __pqTicker?: ReturnType<typeof setInterval> };

function ensureTicker() {
  if (g.__pqTicker) return;
  g.__pqTicker = setInterval(() => {
    const s = store();
    for (const e of s.queue.filter((x) => x.status === "waiting")) {
      const inBucket = s.queue.filter((x) => x.status === "waiting" && bucketKey(x) === bucketKey(e)).length;
      publish(
        "queue.tick",
        { userId: e.userId, waitingSeconds: Math.round((Date.now() - Date.parse(e.joinedAt)) / 1000), inBucket, needed: Math.max(0, PARTY_SIZE - inBucket) },
        [e.userId],
      );
    }
  }, 3000);
  g.__pqTicker.unref?.();
}
