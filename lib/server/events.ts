import type { Event } from "@prisma/client";
import { prisma } from "@/lib/db";
import { haversineKm } from "@/lib/geo";
import { weekendFriday } from "@/lib/seed/seed";
import type { WeightedTag } from "@/lib/profile/builder";

export type FeedTab = "foryou" | "nearby" | "weekend";
export const FEED_TABS: { id: FeedTab; label: string }[] = [
  { id: "foryou", label: "For you" },
  { id: "nearby", label: "Nearby" },
  { id: "weekend", label: "This weekend" },
];
export const NEARBY_KM = 6;

export interface FeedEvent extends Event {
  tagsList: string[];
  friendsInterested: number;
  goingCount: number;
  interestedCount: number;
  distanceKm: number | null;
  relevance: number;
  myRsvp: string | null;
}

export function weekendRange(now: Date) {
  const start = weekendFriday(now);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 3);
  return { start, end };
}

export async function friendIdsOf(userId: string): Promise<Set<string>> {
  const fs = await prisma.friendship.findMany({ where: { OR: [{ userAId: userId }, { userBId: userId }] } });
  return new Set(fs.map((f) => (f.userAId === userId ? f.userBId : f.userAId)));
}

export async function decorateEvents(userId: string, events: Event[]): Promise<FeedEvent[]> {
  const [me, tp, friends, rsvps] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.tasteProfile.findUnique({ where: { userId } }),
    friendIdsOf(userId),
    prisma.eventRsvp.findMany({ where: { eventId: { in: events.map((e) => e.id) } } }),
  ]);
  const weights = new Map(((tp?.interestTags ?? []) as unknown as WeightedTag[]).map((t) => [t.tag, t.weight]));
  return events.map((e) => {
    const rs = rsvps.filter((r) => r.eventId === e.id);
    const tagsList = e.tags as string[];
    const friendsInterested = rs.filter((r) => friends.has(r.userId)).length;
    const distanceKm = me.homeLat != null && me.homeLng != null ? haversineKm({ lat: me.homeLat, lng: me.homeLng }, e) : null;
    const relevance = tagsList.reduce((s, t) => s + (weights.get(t) ?? 0), 0) + friendsInterested * 0.5;
    return {
      ...e,
      tagsList,
      friendsInterested,
      goingCount: rs.filter((r) => r.status === "going").length,
      interestedCount: rs.filter((r) => r.status === "interested").length,
      distanceKm,
      relevance,
      myRsvp: rs.find((r) => r.userId === userId)?.status ?? null,
    };
  });
}

/** Pure filter/sort so it can be unit-tested with a fixed clock. */
export function filterFeed(events: FeedEvent[], tab: FeedTab, now: Date): FeedEvent[] {
  const upcoming = events.filter((e) => e.endsAt > now);
  if (tab === "nearby") {
    return upcoming
      .filter((e) => e.distanceKm != null && e.distanceKm <= NEARBY_KM)
      .sort((a, b) => a.distanceKm! - b.distanceKm! || a.startsAt.getTime() - b.startsAt.getTime());
  }
  if (tab === "weekend") {
    const { start, end } = weekendRange(now);
    return upcoming.filter((e) => e.startsAt >= start && e.startsAt < end).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  }
  return upcoming.sort((a, b) => b.relevance - a.relevance || a.startsAt.getTime() - b.startsAt.getTime());
}

export async function getFeed(userId: string, tab: FeedTab, now: Date) {
  const events = await prisma.event.findMany();
  return filterFeed(await decorateEvents(userId, events), tab, now);
}

export async function getEventDetail(userId: string, eventId: string) {
  const e = await prisma.event.findUnique({ where: { id: eventId }, include: { landmark: true } });
  if (!e) return null;
  const [d] = await decorateEvents(userId, [e]);
  const friends = await friendIdsOf(userId);
  const friendRsvps = await prisma.eventRsvp.findMany({
    where: { eventId, userId: { in: [...friends] } },
    include: { user: { select: { id: true, name: true, avatarColor: true } } },
  });
  return { ...d, landmark: e.landmark, friendRsvps: friendRsvps.map((r) => ({ ...r.user, status: r.status })) };
}
