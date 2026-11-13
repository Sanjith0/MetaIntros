/**
 * Party pipeline: engine proposal → (agent) choice → safety re-check → party + event →
 * squad chat, host, talk cards. Each stage is code-validated.
 */
import { prisma } from "@/lib/db";
import type { Candidate, Proposal } from "@/lib/match/engine";
import { validateParty, isWomenOnlyParty } from "@/lib/match/safety";
import { rankEvents, type GroupContext } from "@/lib/match/eventFit";
import type { Person } from "@/lib/profile/load";
import { dislikeTags } from "@/lib/profile/builder";
import { now as clockNow } from "./clock";
import { weekendRange } from "./events";
import { writeTrace, type TraceStep } from "./trace";
import { fmtWindow, label } from "@/lib/agents/describe";
import { eventSelectionAgent } from "@/lib/agents/eventSelection";
import { startReadyCheck } from "./readyCheck";
import { planHangout } from "./hangout";
import { markFailed, takePending } from "./rooms";
import { toJson } from "@/lib/json";
import { nowDate } from "@/lib/clock";
import { againPairsIn } from "@/lib/match/ratings";
import { ratingSignals, squadTagAffinity } from "./ratings";

/** Deterministic rationale, used when a squad was committed without a Companion-engine run. */
export function templateRationale(c: Candidate) {
  const tags = c.cohesion.sharedTags.slice(0, 3).map((t) => label(t.tag).toLowerCase());
  const w = c.cohesion.bestWindow;
  return `Everyone here shares ${tags.join(", ") || "overlapping interests"}${w ? ` and is free ${fmtWindow(w)}` : ""}. Nobody is a weak link: the lowest pairwise match is ${Math.round(c.cohesion.minPairwise * 100)}%.`;
}

export function groupContext(members: Person[], cand: Candidate, center: { lat: number; lng: number }, ratedTags?: Map<string, number>): GroupContext {
  const tagCounts = new Map<string, number>();
  for (const m of members) for (const t of m.profile.interestTags) tagCounts.set(t.tag, (tagCounts.get(t.tag) ?? 0) + 1);
  const dislikes = new Map<string, string[]>();
  for (const m of members) for (const t of dislikeTags(m.profile)) dislikes.set(t, [...(dislikes.get(t) ?? []), m.id]);
  return { sharedWindows: cand.cohesion.sharedWindows, tagCounts, dislikes, center, size: members.length, ...(ratedTags?.size ? { ratedTags } : {}) };
}

/** Deterministic event pick (fallback + validator for the Event Selection Agent). */
export async function selectEventFallback(members: Person[], cand: Candidate, landmarkId: string) {
  const lm = await prisma.landmark.findUniqueOrThrow({ where: { id: landmarkId } });
  const now = await clockNow();
  if (cand.eventId) {
    const ev = await prisma.event.findUniqueOrThrow({ where: { id: cand.eventId } });
    return ev.isPublicVenue && ev.kind === "event" ? { eventId: ev.id, runnersUp: [] as string[], reasons: ["You queued for this event"] } : null;
  }
  const { end } = weekendRange(now);
  const events = await prisma.event.findMany({ where: { kind: "event", startsAt: { gt: now, lt: end } } });
  const ranked = rankEvents(events.map((e) => ({ ...e, tags: e.tags as string[] })), groupContext(members, cand, lm, await squadTagAffinity(members.map((m) => m.id))), now);
  const ok = ranked.filter((r) => r.ok);
  if (!ok.length) return null;
  return { eventId: ok[0].eventId, runnersUp: ok.slice(1, 3).map((r) => r.eventId), reasons: ok[0].reasons };
}

export type EventChooser = (members: Person[], cand: Candidate, landmarkId: string, partyId: string) => Promise<{ eventId: string; runnersUp: string[]; reasons: string[] } | null>;

/** Default chooser: the Event Selection Agent (its steps go to the party's trace). */
export const agentEventChooser: EventChooser = async (members, cand, landmarkId, partyId) => {
  const lm = await prisma.landmark.findUniqueOrThrow({ where: { id: landmarkId } });
  const now = await clockNow();
  const { end } = weekendRange(now);
  const rows = cand.eventId
    ? await prisma.event.findMany({ where: { id: cand.eventId, kind: "event" } })
    : await prisma.event.findMany({ where: { kind: "event", startsAt: { gt: now, lt: end } } });
  const r = await eventSelectionAgent({
    queuedEventId: cand.eventId,
    events: rows.map((e) => ({ ...e, tags: e.tags as string[] })),
    group: groupContext(members, cand, lm, await squadTagAffinity(members.map((m) => m.id))),
    cand,
    now,
  });
  if (!r) return null;
  await writeTrace(partyId, r.steps);
  return { eventId: r.eventId, runnersUp: r.runnersUp, reasons: r.reasons };
};

let eventChooser: EventChooser = agentEventChooser;
export function setEventChooser(fn: EventChooser) {
  eventChooser = fn;
}


/**
 * "Checked by code" note when post-event ratings shaped this squad. Counts only, never names:
 * nobody can tell who rated whom from it.
 */
export async function ratingSteps(userIds: string[], eventPick = true): Promise<TraceStep[]> {
  const [signals, liked] = await Promise.all([ratingSignals(userIds), squadTagAffinity(userIds)]);
  const parts = [againPairsIn(userIds, signals) ? "who's in this squad" : null, liked.size && eventPick ? "the event pick" : null].filter(Boolean);
  if (!parts.length) return [];
  return [{
    agent: "ratings", kind: "safety_check", output: { usedRatings: true },
    summary: `Used past squad ratings for ${parts.join(" and ")}. Ratings stay private: nobody sees who rated whom.`,
  }];
}

export type FormFailure = "unsafe" | "claim" | "no_event";

/**
 * Commit a chosen candidate as a party. Returns the party id, or the reason no party formed:
 * "unsafe" (safety re-check failed), "claim" (someone already left/matched), "no_event"
 * (no existing event / hangout spot fits this squad — everyone goes back to the queue).
 */
export async function formParty(p: Proposal, c: Candidate, people: Map<string, Person>): Promise<{ partyId: string } | { partyId: null; reason: FormFailure }> {
  const members = c.userIds.map((u) => people.get(u)!);
  // What the Companion engine decided for this squad (rationale, trace, conversations), if it came from a room.
  const room = takePending(c);
  if (!validateParty(members).ok) {
    markFailed(room);
    return { partyId: null, reason: "unsafe" };
  }

  // Claim the entries atomically: if any is no longer waiting, abort.
  const partyId = await prisma.$transaction(async (tx) => {
    const claimed = await tx.queueEntry.updateMany({ where: { id: { in: c.entryIds }, status: "waiting" }, data: { status: "matched", matchedAt: nowDate() } });
    if (claimed.count !== c.entryIds.length) throw new Error("entries no longer waiting");
    const party = await tx.party.create({
      data: {
        landmarkId: p.bucketId,
        targetSize: p.targetSize,
        ageBand: members[0].ageBand,
        womenOnly: isWomenOnlyParty(members),
        cohesion: c.cohesion.score,
        status: "forming",
        members: { create: c.userIds.map((userId) => ({ userId })) },
      },
    });
    await tx.queueEntry.updateMany({ where: { id: { in: c.entryIds } }, data: { partyId: party.id } });
    return party.id;
  }).catch(() => null);
  if (!partyId) {
    markFailed(room);
    return { partyId: null, reason: "claim" };
  }
  await prisma.party.update({ where: { id: partyId }, data: { rationale: room?.party.why ?? templateRationale(c) } });
  if (room) await writeTrace(partyId, room.party.steps);
  // Queue together: say which people came as a group (the engine never splits them).
  const grouped = await prisma.queueEntry.findMany({ where: { id: { in: c.entryIds }, groupId: { not: null } }, select: { groupId: true, userId: true } });
  const byGroup = new Map<string, string[]>();
  for (const e of grouped) byGroup.set(e.groupId!, [...(byGroup.get(e.groupId!) ?? []), e.userId]);
  const togetherSteps: TraceStep[] = [...byGroup.values()].filter((ids) => ids.length > 1).map((ids) => {
    const names = ids.map((id) => people.get(id)?.name.split(" ")[0] ?? "").filter(Boolean);
    return { agent: "orchestrator", kind: "safety_check", output: { together: ids }, summary: `Kept ${names.slice(0, -1).join(", ")} and ${names[names.length - 1]} together: they queued as a group` };
  });
  if (togetherSteps.length) await writeTrace(partyId, togetherSteps);
  await writeTrace(partyId, await ratingSteps(c.userIds, p.mode !== "hangout"));

  // Existing-events queue → pick a real event; hangout queue → plan a new one at common ground.
  const choice =
    p.mode === "hangout"
      ? await planHangout(members, c, p.bucketId, partyId).catch(() => null)
      : (await eventChooser(members, c, p.bucketId, partyId).catch(() => null)) ?? (await selectEventFallback(members, c, p.bucketId));
  const event = choice ? await prisma.event.findUnique({ where: { id: choice.eventId } }) : null;
  const wrongKind = event && (p.mode === "hangout") !== (event.kind === "hangout");
  if (!event || wrongKind || !validateParty(members, event).ok) {
    // No safe event → release everyone back to the queue (and drop a hangout we just created).
    if (event?.kind === "hangout") await prisma.event.delete({ where: { id: event.id } }).catch(() => {});
    await prisma.$transaction([
      prisma.queueEntry.updateMany({ where: { id: { in: c.entryIds } }, data: { status: "waiting", partyId: null, matchedAt: null } }),
      prisma.party.update({ where: { id: partyId }, data: { status: "cancelled" } }),
    ]);
    markFailed(room); // don't let the same room propose this exact group again
    return { partyId: null, reason: "no_event" };
  }
  // What each member gets to see about how the squad was decided, and the Companions' conversations
  // between squadmates (they feed the talk cards). Saved before anyone sees the squad.
  if (room?.recaps.size) {
    await prisma.companionRecap.createMany({ data: [...room.recaps].map(([userId, recap]) => ({ partyId, userId, data: toJson(recap) })) });
  }
  if (room?.preChats.length) {
    await prisma.preChat.createMany({
      data: room.preChats.map((pc) => ({ partyId, userAId: pc.a, userBId: pc.b, transcript: toJson(pc.transcript), sparks: toJson(pc.sparks), simulated: true, aiSource: room.source })),
    });
  }
  // Ready check: real members tap "I'm in" before the squad is revealed and the chat opens (readyCheck.ts).
  await startReadyCheck(partyId, event.id);
  return { partyId };
}
