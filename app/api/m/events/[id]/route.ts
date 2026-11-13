import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/server/session";
import { getEventDetail } from "@/lib/server/events";
import { now } from "@/lib/server/clock";
import { getStatusCard } from "@/lib/server/status";
import { pulseLine, queuePulse } from "@/lib/server/pulse";
import { eventCoverSrc } from "@/lib/images";

export const dynamic = "force-dynamic";

/** One event as JSON, for the Expo app (mirrors app/(app)/events/[id]/page.tsx). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getCurrentUser();
  const e = await getEventDetail(me.id, id);
  if (!e) return NextResponse.json({ error: "not found" }, { status: 404 });
  const t = await now();
  const [card, pulse, landmarks] = await Promise.all([
    getStatusCard(me.id, t, id),
    queuePulse(id),
    prisma.landmark.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, city: true } }),
  ]);
  return NextResponse.json({
    me: { id: me.id, name: me.name },
    event: {
      id: e.id, kind: e.kind, title: e.title, startsAt: e.startsAt, endsAt: e.endsAt, venueName: e.venueName, venueAddress: e.venueAddress,
      description: e.description, tags: e.tagsList, isPublicVenue: e.isPublicVenue, coverColor: e.coverColor, coverPattern: e.coverPattern,
      cover: eventCoverSrc(e.id) ?? null, myRsvp: e.myRsvp, goingCount: e.goingCount, interestedCount: e.interestedCount,
      friendRsvps: e.friendRsvps,
    },
    card,
    pulse: pulseLine(pulse),
    landmarks,
    shareDefault: me.queueVisibility === "friends",
  });
}
