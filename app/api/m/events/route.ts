import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/server/session";
import { FEED_TABS, getFeed, type FeedTab } from "@/lib/server/events";
import { now } from "@/lib/server/clock";
import { listActiveSquads, squadEventIds } from "@/lib/server/squads";
import { getStatusCard } from "@/lib/server/status";
import { pulseLine, queuePulse } from "@/lib/server/pulse";
import { eventCoverSrc } from "@/lib/images";
import { listFriendQueues } from "@/lib/server/friendQueues";

export const dynamic = "force-dynamic";

/** The Events tab as JSON, for the Expo app (mirrors app/(app)/events/page.tsx). */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const tab = (FEED_TABS.some((t) => t.id === sp.get("tab")) ? sp.get("tab") : "foryou") as FeedTab;
  const me = await getCurrentUser();
  const t = await now();
  const [feed, squads, card, pulse, upcoming, landmarks, mySquads, friendQueues] = await Promise.all([
    getFeed(me.id, tab, t),
    squadEventIds(me.id),
    getStatusCard(me.id, t),
    queuePulse(),
    getFeed(me.id, "foryou", t),
    prisma.landmark.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, city: true } }),
    listActiveSquads(me.id),
    listFriendQueues(me.id),
  ]);
  const squadCard = card?.state === "ready" || card?.state === "venue" || card?.state === "after";
  const showSquads = mySquads.length >= 2 || (mySquads.length === 1 && !squadCard);
  const showCard = Boolean(card) && !(squadCard && mySquads.length >= 2);
  const pickable = upcoming
    .filter((e) => e.isPublicVenue)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
    .slice(0, 10)
    .map((e) => ({ id: e.id, title: e.title, startsAt: e.startsAt.toISOString(), venue: e.venueName, isPublic: true, mine: Boolean(e.myRsvp) }));
  const showEntry = !card || card.state === "ready" || card.state === "venue" || card.state === "after";
  return NextResponse.json({
    tabs: FEED_TABS,
    tab,
    card: showCard ? card : null,
    mySquads: showSquads ? mySquads : [],
    showEntry,
    again: showCard && card?.state === "after",
    also: (showCard && (card?.state === "ready" || card?.state === "venue")) || mySquads.length >= 2,
    friendQueues,
    nowMs: t.getTime(),
    pulse: pulseLine(pulse),
    pickable,
    landmarks,
    shareDefault: me.queueVisibility === "friends",
    feed: feed.map((e) => ({
      id: e.id, title: e.title, startsAt: e.startsAt, venueName: e.venueName, coverColor: e.coverColor, coverPattern: e.coverPattern,
      cover: eventCoverSrc(e.id) ?? null, friendsInterested: e.friendsInterested, goingCount: e.goingCount, distanceKm: e.distanceKm,
      myRsvp: e.myRsvp ?? null, squad: squads.has(e.id), ratedBoost: e.ratedBoost,
    })),
  });
}
