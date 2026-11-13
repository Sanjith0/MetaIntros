import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { TopBar } from "@/components/fb/TopBar";
import { FacePile, Stack } from "@/components/fb";
import { EventCover } from "@/components/events/EventCover";
import { DateLine } from "@/components/events/DateLine";
import { eventCoverSrc } from "@/lib/images";
import { Post } from "@/components/feed/Post";
import { HomeTop } from "@/components/posts/HomeTop";
import { RealPost } from "@/components/posts/RealPost";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/server/session";
import { POSTS, STORIES } from "@/lib/mock/feed";
import { friendQueueSummary } from "@/lib/server/friendQueues";
import { listFeed, myAlbums } from "@/lib/server/posts";
import { now as clockNow } from "@/lib/server/clock";
import { timeAgo } from "@/lib/format";

/**
 * Home: real posts and stories (yours, and friends' shared with friends) lead; the seeded mock feed
 * follows. One mock post shares an event, which is how people reach Events from Home.
 */
export default async function HomePage() {
  const me = await getCurrentUser();
  const now = await clockNow();
  const [shared, fq, feed, albums] = await Promise.all([
    prisma.event.findMany({ where: { id: { in: POSTS.flatMap((p) => (p.eventId ? [p.eventId] : [])) } } }),
    friendQueueSummary(me.id),
    listFeed(me.id, now),
    myAlbums(me.id),
  ]);
  const ago = (iso: string) => timeAgo(new Date(iso), now);
  const stories = feed.stories.map((g) => ({
    author: g.author,
    mine: g.mine,
    stories: g.frames.map((s) => ({ id: s.id, caption: s.caption, photos: s.photos, ago: ago(s.createdAt), event: s.event ? { title: s.event.title } : null, audience: s.audience, aiSource: s.aiSource, aiEdited: s.aiEdited })),
  }));
  return (
    <div data-testid="home-page">
      <TopBar variant="home" />
      <Stack>
        <HomeTop me={{ name: me.name, avatarColor: me.avatarColor }} stories={stories} mockStories={STORIES} albums={albums} />
        {fq.count > 0 && fq.first && (
          <Link href="/events#friends-queuing" className="flex items-center gap-3 bg-surface px-4 py-3 hover:bg-press" data-testid="home-friend-queues">
            <FacePile people={fq.faces} size={36} max={3} />
            <span className="min-w-0 flex-1">
              <span className="block text-body font-semibold">
                {fq.count === 1 ? `${fq.first.friend.name.split(" ")[0]} is queuing this weekend` : `${fq.count} friends are queuing this weekend`}
              </span>
              <span className="block truncate text-meta text-muted">
                {fq.count === 1 ? fq.first.label : `${fq.first.friend.name.split(" ")[0]}: ${fq.first.label.charAt(0).toLowerCase()}${fq.first.label.slice(1)}`} · Queue up too
              </span>
            </span>
            <ChevronRight size={20} className="text-muted" aria-hidden />
          </Link>
        )}
        {feed.posts.map((p) => (
          <RealPost key={p.id} post={p} ago={ago(p.createdAt)} />
        ))}
        {POSTS.map((p) => {
          const ev = shared.find((e) => e.id === p.eventId);
          return (
            <Post key={p.id} who={p.who} color={p.color} avatarUrl={p.avatar} ago={p.ago} text={p.text} likes={p.likes} comments={p.comments}>
              {ev ? (
                <Link href={`/events/${ev.id}`} className="block" data-testid="feed-event">
                  <EventCover color={ev.coverColor} pattern={ev.coverPattern} src={eventCoverSrc(ev.id)} label={ev.title} className="aspect-[2/1]" />
                  <div className="bg-wash px-4 py-2">
                    <DateLine start={ev.startsAt} />
                    <p className="truncate text-body font-semibold">{ev.title}</p>
                    <p className="truncate text-meta text-muted">{ev.venueName}</p>
                  </div>
                </Link>
              ) : p.photo ? (
                <EventCover color={p.color} pattern="dots" src={p.photo} label={`Photo from ${p.who}`} className="aspect-[4/3]" />
              ) : null}
            </Post>
          );
        })}
      </Stack>
    </div>
  );
}
