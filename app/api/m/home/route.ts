import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/server/session";
import { POSTS, STORIES } from "@/lib/mock/feed";
import { friendQueueSummary } from "@/lib/server/friendQueues";
import { listFeed, myAlbums } from "@/lib/server/posts";
import { now as clockNow } from "@/lib/server/clock";
import { timeAgo } from "@/lib/format";
import { eventCoverSrc } from "@/lib/images";

export const dynamic = "force-dynamic";

/** Home as JSON, for the Expo app (mirrors app/(app)/home/page.tsx). */
export async function GET() {
  const me = await getCurrentUser();
  const t = await clockNow();
  const [shared, fq, feed, albums] = await Promise.all([
    prisma.event.findMany({ where: { id: { in: POSTS.flatMap((p) => (p.eventId ? [p.eventId] : [])) } } }),
    friendQueueSummary(me.id),
    listFeed(me.id, t),
    myAlbums(me.id),
  ]);
  const ago = (iso: string | Date) => timeAgo(new Date(iso), t);
  const stories = feed.stories.map((g) => ({
    author: g.author,
    mine: g.mine,
    stories: g.frames.map((s) => ({ id: s.id, caption: s.caption, photos: s.photos, ago: ago(s.createdAt), event: s.event ? { title: s.event.title } : null, audience: s.audience, aiSource: s.aiSource, aiEdited: s.aiEdited })),
  }));
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
  return NextResponse.json({ me: { id: me.id, name: me.name, avatarColor: me.avatarColor }, friendQueues: fq, posts, stories, mockStories: STORIES, albums });
}
