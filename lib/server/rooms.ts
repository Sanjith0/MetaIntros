/**
 * Runs the Companion engine for one queue "room" and turns what the Companions and the
 * Orchestrator decided into the Candidate objects the party pipeline commits.
 */
import { prisma } from "@/lib/db";
import { toJson } from "@/lib/json";
import { pairKey, runRoom, sparksFor, type RoomParty } from "@/lib/companion/room";
import type { QueueContext } from "@/lib/companion/brief";
import { groupCohesion } from "@/lib/match/cohesion";
import { makePairScorer } from "@/lib/match/compat";
import type { Candidate, QueueItem } from "@/lib/match/engine";
import type { Person } from "@/lib/profile/load";
import { rankEvents, type GroupContext } from "@/lib/match/eventFit";
import { rankHangouts, type Spot } from "@/lib/match/hangoutFit";
import { dislikeTags } from "@/lib/profile/builder";
import SPOTS from "@/data/seed/spots.json";
import { ensureBriefs } from "./briefs";
import { now as clockNow } from "./clock";
import { weekendRange } from "./events";
import { publish } from "./bus";

export interface PendingRoom {
  signature: string;
  userIds: string[];
  party: RoomParty;
  preChats: { a: string; b: string; transcript: { speaker: "A" | "B"; text: string }[]; sparks: string[] }[];
}

interface State {
  /** candidate key → what the engine decided for it */
  pending: Map<string, PendingRoom>;
  /** room signature → member sets that could not be committed */
  failed: Map<string, string[][]>;
  /** room signatures that ended with nothing to commit */
  settled: Set<string>;
}
const g = globalThis as unknown as { __quRooms?: State };
const state = () => (g.__quRooms ??= { pending: new Map(), failed: new Map(), settled: new Set() });

const candKey = (c: Pick<Candidate, "entryIds">) => [...c.entryIds].sort().join(",");

export function resetRooms() {
  g.__quRooms = undefined;
}

/** The engine's decision for a candidate (removed once taken). */
export function takePending(c: Candidate): PendingRoom | null {
  const k = candKey(c);
  const p = state().pending.get(k) ?? null;
  state().pending.delete(k);
  return p;
}

/** A squad the engine chose could not be committed: never propose that exact group from this room again. */
export function markFailed(room: PendingRoom | null) {
  if (!room) return;
  const s = state();
  s.failed.set(room.signature, [...(s.failed.get(room.signature) ?? []), room.userIds]);
  s.settled.delete(room.signature);
}

const wrap = (ids: string[]) => `,${ids.join(",")},`;

/**
 * Can this group actually meet? The Companions judge who gets along; code makes sure a squad is
 * only formed if there is somewhere it can go: a public hangout spot near everyone with a slot
 * they can all make, or (in the "any event" queue) an event that fits all of them.
 */
async function feasibility(anchor: QueueItem, room: QueueItem[], people: Map<string, Person>): Promise<((members: string[]) => boolean) | undefined> {
  const mode = anchor.mode ?? "events";
  const eventId = room.find((r) => r.eventId)?.eventId ?? null;
  if (mode === "events" && eventId) return undefined; // everyone goes to the event they queued for
  const landmarks = new Map((await prisma.landmark.findMany()).map((l) => [l.id, l]));
  const now = await clockNow();
  const entryOf = new Map(room.map((r) => [r.userId, r]));
  const score = makePairScorer();
  const context = (members: string[]): GroupContext => {
    const ps = members.map((m) => people.get(m)!);
    const tagCounts = new Map<string, number>();
    for (const p of ps) for (const t of p.profile.interestTags) tagCounts.set(t.tag, (tagCounts.get(t.tag) ?? 0) + 1);
    const dislikes = new Map<string, string[]>();
    for (const p of ps) for (const t of dislikeTags(p.profile)) dislikes.set(t, [...(dislikes.get(t) ?? []), p.id]);
    return { sharedWindows: groupCohesion(ps, score).sharedWindows, tagCounts, dislikes, center: landmarks.get(anchor.bucketId)!, size: ps.length };
  };
  if (mode === "hangout") {
    const horizon = new Date(now.getTime() + 7 * 86_400_000);
    return (members) => {
      const g = context(members);
      const areas = members.map((m) => landmarks.get(entryOf.get(m)!.bucketId)!);
      return rankHangouts(SPOTS as Spot[], { sharedWindows: g.sharedWindows, tagCounts: g.tagCounts, dislikes: g.dislikes, size: g.size, memberAreas: areas }, now, horizon).some((o) => o.ok);
    };
  }
  const { end } = weekendRange(now);
  const events = (await prisma.event.findMany({ where: { kind: "event", startsAt: { gt: now, lt: end } } })).map((e) => ({ ...e, tags: e.tags as string[] }));
  return (members) => rankEvents(events, context(members), now).some((r) => r.ok);
}

export async function matchRoom(anchor: QueueItem, room: QueueItem[], people: Map<string, Person>): Promise<Candidate[]> {
  const s = state();
  const signature = room.map((r) => r.entryId).sort().join(",");
  if (s.settled.has(signature)) return [];
  const userIds = room.map((r) => r.userId);
  const entryOf = new Map(room.map((r) => [r.userId, r]));
  const real = userIds.filter((u) => !people.get(u)!.isSimulated);
  const eventId = room.find((r) => r.eventId)?.eventId ?? null;
  const event = eventId ? await prisma.event.findUnique({ where: { id: eventId }, select: { title: true } }) : null;
  const ctx: QueueContext = { mode: anchor.mode ?? "events", eventTitle: event?.title ?? null, targetSize: anchor.targetSize };

  const row = await prisma.matchRoom.create({ data: { signature, anchorUserId: anchor.userId, userIds: wrap(userIds), stage: "briefing", note: "Companions are reading their people's profiles" } });
  const announce = (stage: string, note: string) => publish("queue", { type: "stage", stage, note }, real);
  announce(row.stage, row.note);
  try {
    // A brief costs a model call only when a real person is in the room.
    const feasible = await feasibility(anchor, room, people);
    const briefs = await ensureBriefs(userIds.map((u) => people.get(u)!), ctx, () => real.length > 0);
    const result = await runRoom({
      ids: userIds,
      people,
      briefs,
      targetSize: anchor.targetSize,
      exclude: s.failed.get(signature) ?? [],
      // Real people are placed first; squads made only of simulated fillers are not formed.
      priority: real.length ? real : [anchor.userId],
      onlyPriority: true,
      feasible,
      onStage: async (stage, note) => {
        if (stage === "done" || stage === "waiting") return;
        await prisma.matchRoom.update({ where: { id: row.id }, data: { stage, note } });
        announce(stage, note);
      },
    });

    const score = makePairScorer();
    // Only squads with the anchor or a real person are committed; simulated spares are withdrawn afterwards.
    const keep = result.parties.filter((p) => p.members.includes(anchor.userId) || p.members.some((m) => !people.get(m)!.isSimulated));
    keep.sort((a, b) => Number(b.members.includes(anchor.userId)) - Number(a.members.includes(anchor.userId)));
    const candidates: Candidate[] = keep.map((party) => {
      const members = party.members;
      const c: Candidate = {
        entryIds: members.map((m) => entryOf.get(m)!.entryId),
        userIds: members,
        eventId: members.map((m) => entryOf.get(m)!.eventId).find(Boolean) ?? null,
        cohesion: groupCohesion(members.map((m) => people.get(m)!), score),
      };
      const preChats: PendingRoom["preChats"] = [];
      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          const [a, b] = members[i] < members[j] ? [members[i], members[j]] : [members[j], members[i]];
          const thread = result.threads.get(pairKey(a, b));
          if (!thread) continue;
          preChats.push({ a, b, transcript: thread.map((m) => ({ speaker: m.from === a ? ("A" as const) : ("B" as const), text: m.say })), sparks: sparksFor(a, b, result) });
        }
      }
      s.pending.set(candKey(c), { signature, userIds: members, party, preChats });
      return c;
    });

    const stage = candidates.length ? "done" : "waiting";
    await prisma.matchRoom.update({
      where: { id: row.id },
      data: { stage, note: candidates.length ? "Squad chosen" : "No squad clicked yet", result: toJson({ circles: result.circles.map((c) => ({ id: c.id, theme: c.theme, size: c.members.length })), squads: candidates.length, revisedAfterSignOff: result.vetoed.length, modelCalls: result.calls }) },
    });
    announce(stage, "");
    if (!candidates.length) s.settled.add(signature);
    return candidates;
  } catch (e) {
    console.error("[room]", e);
    await prisma.matchRoom.update({ where: { id: row.id }, data: { stage: "waiting", note: "", result: toJson({ error: true }) } }).catch(() => {});
    return [];
  }
}

/** What the engine is doing right now for a waiting user, if a room is running for them. */
export async function roomStageFor(userId: string): Promise<{ stage: string; note: string } | null> {
  const row = await prisma.matchRoom.findFirst({
    where: { userIds: { contains: `,${userId},` }, stage: { notIn: ["done", "waiting"] }, updatedAt: { gt: new Date(Date.now() - 5 * 60_000) } },
    orderBy: { createdAt: "desc" },
    select: { stage: true, note: true },
  });
  return row;
}
