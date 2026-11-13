/**
 * "New hangout" queue: once a squad forms, plan a hangout at a public spot that's common ground for
 * everyone, and store it as a squad-only Event (kind "hangout") so chat, check-ins, expiry and
 * "Met through Link" all work exactly as for real events. It never appears in the feed.
 */
import { prisma } from "@/lib/db";
import SPOTS from "@/data/seed/spots.json";
import type { Candidate } from "@/lib/match/engine";
import type { HangoutGroup, Spot } from "@/lib/match/hangoutFit";
import { hangoutPlannerAgent, type HangoutPlan } from "@/lib/agents/hangoutPlanner";
import type { Person } from "@/lib/profile/load";
import { now as clockNow } from "./clock";
import { weekendRange } from "./events";
import { groupContext } from "./pipeline";
import { writeTrace } from "./trace";

export const HANGOUT_SPOTS = SPOTS as Spot[];
export const HANGOUT_MIN_HORIZON_MS = 2 * 86_400_000;

/** How far ahead a hangout may be planned: the same window as the existing-events queue ("this weekend"), so Fast-forward jumps stay short. */
export function hangoutHorizon(now: Date): Date {
  return new Date(Math.max(weekendRange(now).end.getTime(), now.getTime() + HANGOUT_MIN_HORIZON_MS));
}

export async function hangoutGroup(members: Person[], cand: Candidate, bucketId: string): Promise<HangoutGroup> {
  const entries = await prisma.queueEntry.findMany({ where: { id: { in: cand.entryIds } }, include: { bucketLandmark: true } });
  const lm = await prisma.landmark.findUniqueOrThrow({ where: { id: bucketId } });
  const g = groupContext(members, cand, lm);
  const areas = entries.length ? entries.map((e) => ({ lat: e.bucketLandmark.lat, lng: e.bucketLandmark.lng })) : [lm];
  return { sharedWindows: g.sharedWindows, tagCounts: g.tagCounts, dislikes: g.dislikes, size: g.size, memberAreas: areas };
}

export type HangoutPlanner = (input: Parameters<typeof hangoutPlannerAgent>[0]) => Promise<HangoutPlan | null>;
let planner: HangoutPlanner = hangoutPlannerAgent;
export function setHangoutPlanner(fn: HangoutPlanner) {
  planner = fn;
}

/** Plan + persist the hangout. Returns the new event id, or null if no spot is safe for this squad. */
export async function planHangout(members: Person[], cand: Candidate, bucketId: string, partyId: string): Promise<{ eventId: string } | null> {
  const now = await clockNow();
  const group = await hangoutGroup(members, cand, bucketId);
  const horizon = hangoutHorizon(now);
  const plan = await planner({ spots: HANGOUT_SPOTS, group, now, horizon }).catch(() => null);
  if (!plan) return null;
  await writeTrace(partyId, plan.steps);
  const { spot, option } = plan;
  const ev = await prisma.event.create({
    data: {
      id: `hg-${partyId}`,
      kind: "hangout",
      title: plan.title,
      description: plan.plan,
      tags: spot.tags,
      startsAt: option.startsAt,
      endsAt: option.endsAt,
      venueName: spot.name,
      venueAddress: spot.address,
      lat: spot.lat,
      lng: spot.lng,
      isPublicVenue: spot.isPublic !== false,
      capacity: members.length,
      coverColor: spot.coverColor ?? "#0f766e",
      coverPattern: spot.coverPattern ?? "dots",
      hostName: "Link",
      landmarkId: spot.landmarkId,
    },
  });
  return { eventId: ev.id };
}
