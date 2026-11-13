import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/server/session";
import { POSTS } from "@/lib/mock/feed";
import { friendQueueSummary } from "@/lib/server/friendQueues";
import { listFeed } from "@/lib/server/posts";
import { now as clockNow } from "@/lib/server/clock";
import { timeAgo } from "@/lib/format";
import { eventCoverSrc } from "@/lib/images";

export const dynamic = "force-dynamic";

/** Home as JSON, for the Expo app (mirrors app/(app)/home/page.tsx, without stories and albums). */
export async function GET() {
  const me = await getCurrentUser();
  const t = await clockNow();
  const [shared, fq, feed] = await Promise.all([
    prisma.event.findMany({ where: { id: { in: POSTS.flatMap((p) => (p.eventId ? [p.eventId] : [])) } } }),
    friendQueueSummary(me.id),
    listFeed(me.id, t),
  ]);
  const posts = [
    ...feed.posts.map((p) => ({ ...p, ago: timeAgo(new Date(p.createdAt), t), kind: "real" as const })),
    ...POSTS.map((p) => {
      const ev = shared.find((e) => e.id === p.eventId);
      return {
        kind: "mock" as const, ...p,
        event: ev ? { id: ev.id, title: ev.title, startsAt: ev.startsAt, venueName: ev.venueName, coverColor: ev.coverColor, cover: eventCoverSrc(ev.id) ?? null } : null,
      };
    }),
  ];
  return NextResponse.json({ me: { id: me.id, name: me.name, avatarColor: me.avatarColor }, friendQueues: fq, posts });
}
