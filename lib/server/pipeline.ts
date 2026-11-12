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
import { publish } from "./bus";
import { now as clockNow } from "./clock";
import { weekendRange } from "./events";
import { writeTrace, type TraceStep } from "./trace";
import { partyFormationAgent, templateRationale } from "@/lib/agents/partyFormation";
import { eventSelectionAgent } from "@/lib/agents/eventSelection";
import { afterPartyConfirmed } from "./hooks";
import { planHangout } from "./hangout";

const pending = new Map<string, { steps: TraceStep[]; rationale: string }>();
const candKey = (c: Candidate) => [...c.entryIds].sort().join(",");

/** Party Formation Agent picks among the engine's candidates (its trace is kept until the party exists). */
export async function chooseCandidate(p: Proposal, people: Map<string, Person>): Promise<Candidate | null> {
  const r = await partyFormationAgent(p, people);
  pending.set(candKey(r.candidate), { steps: r.steps, rationale: r.rationale });
  return r.candidate;
}

export function groupContext(members: Person[], cand: Candidate, center: { lat: number; lng: number }): GroupContext {
  const tagCounts = new Map<string, number>();
  for (const m of members) for (const t of m.profile.interestTags) tagCounts.set(t.tag, (tagCounts.get(t.tag) ?? 0) + 1);
  const dislikes = new Map<string, string[]>();
  for (const m of members) for (const t of dislikeTags(m.profile)) dislikes.set(t, [...(dislikes.get(t) ?? []), m.id]);
  return { sharedWindows: cand.cohesion.sharedWindows, tagCounts, dislikes, center, size: members.length };
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
  const ranked = rankEvents(events.map((e) => ({ ...e, tags: e.tags as string[] })), groupContext(members, cand, lm), now);
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
    group: groupContext(members, cand, lm),
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


/** Commit a chosen candidate as a party. Returns null (no party) if anything fails validation. */
export async function formParty(p: Proposal, c: Candidate, people: Map<string, Person>): Promise<string | null> {
  const members = c.userIds.map((u) => people.get(u)!);
  if (!validateParty(members).ok) return null;

  // Claim the entries atomically: if any is no longer waiting, abort.
  const partyId = await prisma.$transaction(async (tx) => {
    const claimed = await tx.queueEntry.updateMany({ where: { id: { in: c.entryIds }, status: "waiting" }, data: { status: "matched", matchedAt: new Date() } });
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
  if (!partyId) return null;
  const agentOut = pending.get(candKey(c));
  pending.delete(candKey(c));
  await prisma.party.update({ where: { id: partyId }, data: { rationale: agentOut?.rationale ?? templateRationale(c) } });
  if (agentOut) await writeTrace(partyId, agentOut.steps);

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
    return null;
  }
  await prisma.party.update({ where: { id: partyId }, data: { eventId: event.id, status: "confirmed" } });
  await afterPartyConfirmed(partyId);
  publish("party", { type: "formed", partyId, eventId: event.id }, c.userIds);
  publish("badges", {}, c.userIds);
  publish("demo", { type: "party", partyId });
  return partyId;
}
