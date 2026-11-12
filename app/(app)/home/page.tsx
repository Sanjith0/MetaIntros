import Link from "next/link";
import { ChevronRight, Image as ImageIcon, Plus } from "lucide-react";
import { TopBar } from "@/components/fb/TopBar";
import { Avatar, FacePile, Stack } from "@/components/fb";
import { EventCover } from "@/components/events/EventCover";
import { DateLine } from "@/components/events/DateLine";
import { Post } from "@/components/feed/Post";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/server/session";
import { POSTS, STORIES } from "@/lib/mock/feed";
import { friendQueueSummary } from "@/lib/server/friendQueues";

/** Home: a seeded mock feed. One post shares an event, which is how people reach Events from Home. */
export default async function HomePage() {
  const me = await getCurrentUser();
  const [shared, fq] = await Promise.all([
    prisma.event.findMany({ where: { id: { in: POSTS.flatMap((p) => (p.eventId ? [p.eventId] : [])) } } }),
    friendQueueSummary(me.id),
  ]);
  return (
    <div data-testid="home-page">
      <TopBar variant="home" />
      <Stack>
        <div className="flex items-center gap-2 bg-surface px-4 py-2">
          <Avatar name={me.name} color={me.avatarColor} size={40} />
          <div className="flex h-10 flex-1 items-center rounded-full border border-divider px-4 text-body text-muted">What&apos;s on your mind?</div>
          <ImageIcon size={24} className="text-positive" aria-label="Photo" />
        </div>
        <div className="no-scrollbar flex gap-2 overflow-x-auto bg-surface px-4 py-3">
          <div className="flex h-44 w-24 shrink-0 flex-col overflow-hidden rounded-card border border-divider/70">
            <div className="flex flex-1 items-center justify-center bg-wash"><Avatar name={me.name} color={me.avatarColor} size={48} /></div>
            <div className="relative h-12 pt-5 text-center text-meta font-semibold">
              <span className="absolute -top-4 left-1/2 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full bg-accent text-surface ring-4 ring-surface"><Plus size={16} strokeWidth={3} /></span>
              Create story
            </div>
          </div>
          {STORIES.map((s) => (
            <EventCover key={s.id} color={s.color} pattern={s.pattern} label={`${s.name}'s story`} className="h-44 w-24 shrink-0 rounded-card">
              <span className="absolute top-2 left-2"><Avatar name={s.name} color={s.color} size={32} className="ring-2 ring-accent" /></span>
              <span className="absolute right-2 bottom-2 left-2 text-meta leading-tight font-semibold text-surface">{s.name}</span>
            </EventCover>
          ))}
        </div>
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
        {POSTS.map((p) => {
          const ev = shared.find((e) => e.id === p.eventId);
          return (
            <Post key={p.id} who={p.who} color={p.color} ago={p.ago} text={p.text} likes={p.likes} comments={p.comments}>
              {ev ? (
                <Link href={`/events/${ev.id}`} className="block" data-testid="feed-event">
                  <EventCover color={ev.coverColor} pattern={ev.coverPattern} className="aspect-[2/1]" />
                  <div className="bg-wash px-4 py-2">
                    <DateLine start={ev.startsAt} />
                    <p className="truncate text-body font-semibold">{ev.title}</p>
                    <p className="truncate text-meta text-muted">{ev.venueName}</p>
                  </div>
                </Link>
              ) : p.cover ? (
                <EventCover color={p.cover.color} pattern={p.cover.pattern} className="aspect-[2/1]" />
              ) : null}
            </Post>
          );
        })}
      </Stack>
    </div>
  );
}
