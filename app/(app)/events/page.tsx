import { TopBar } from "@/components/fb/TopBar";
import { ChipLink, ChipRow, Section, Stack } from "@/components/fb";
import { EventCard } from "@/components/events/EventCard";
import { QueueEntry } from "@/components/queueup/QueueEntry";
import { StatusCard } from "@/components/queueup/StatusCard";
import { FriendQueues } from "@/components/queueup/FriendQueues";
import { listFriendQueues } from "@/lib/server/friendQueues";
import { getCurrentUser } from "@/lib/server/session";
import { FEED_TABS, getFeed, type FeedTab } from "@/lib/server/events";
import { getCurrentUserId } from "@/lib/server/session";
import { now } from "@/lib/server/clock";
import { squadEventIds } from "@/lib/server/squads";
import { getStatusCard } from "@/lib/server/status";
import { pulseLine, queuePulse } from "@/lib/server/pulse";
import { prisma } from "@/lib/db";

export default async function EventsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const sp = await searchParams;
  const tab = (FEED_TABS.some((t) => t.id === sp.tab) ? sp.tab : "foryou") as FeedTab;
  const userId = await getCurrentUserId();
  const t = await now();
  const [feed, squads, card, pulse, upcoming, landmarks, friendQueues, me] = await Promise.all([
    getFeed(userId, tab, t),
    squadEventIds(userId),
    getStatusCard(userId, t),
    queuePulse(),
    getFeed(userId, "foryou", t),
    prisma.landmark.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, city: true } }),
    listFriendQueues(userId),
    getCurrentUser(),
  ]);
  // "An event you pick": public events, the ones you're interested in first (Jordan's story).
  const pickable = upcoming
    .filter((e) => e.isPublicVenue)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
    .slice(0, 10)
    .map((e) => ({ id: e.id, title: e.title, startsAt: e.startsAt.toISOString(), venue: e.venueName, isPublic: true, mine: Boolean(e.myRsvp) }));
  const heading = { foryou: "Suggested for you", nearby: "Near you", weekend: "This weekend" }[tab];

  return (
    <div data-testid="events-page">
      <TopBar title="Events" />
      <Stack>
        <div className="bg-surface px-4 pt-1 pb-3">
          <ChipRow label="Filter events">
            {FEED_TABS.map((f) => (
              <ChipLink key={f.id} href={`/events?tab=${f.id}`} on={f.id === tab} data-testid={`feed-tab-${f.id}`} scroll={false}>
                {f.label}
              </ChipLink>
            ))}
          </ChipRow>
        </div>

        {card ? <StatusCard card={card} /> : <QueueEntry pulse={pulseLine(pulse)} events={pickable} landmarks={landmarks} shareDefault={me.queueVisibility === "friends"} />}

        <FriendQueues queues={friendQueues} nowMs={t.getTime()} />

        <Section title={heading} className="pb-4">
          <ul className="flex flex-col gap-3" data-testid="event-feed" data-count={feed.length}>
            {feed.map((e) => (
              <li key={e.id}>
                <EventCard e={e} squad={squads.has(e.id)} />
              </li>
            ))}
            {feed.length === 0 && <li className="py-8 text-center text-muted">No events here yet. Try another filter.</li>}
          </ul>
        </Section>
      </Stack>
    </div>
  );
}
