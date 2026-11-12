import Link from "next/link";
import { Sparkles, Swords } from "lucide-react";
import { EventCard } from "@/components/EventCard";
import { FEED_TABS, getFeed, type FeedTab } from "@/lib/server/events";
import { getCurrentUserId } from "@/lib/server/session";
import { now } from "@/lib/server/clock";
import { squadEventIds } from "@/lib/server/squads";

export default async function EventsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const sp = await searchParams;
  const tab = (FEED_TABS.some((t) => t.id === sp.tab) ? sp.tab : "foryou") as FeedTab;
  const userId = await getCurrentUserId();
  const [feed, squads] = await Promise.all([getFeed(userId, tab, await now()), squadEventIds(userId)]);
  return (
    <div data-testid="events-page" className="px-3 pt-3">
      <h1 className="text-2xl font-bold">Events</h1>
      <div className="mt-2 flex gap-2" role="tablist">
        {FEED_TABS.map((t) => (
          <Link
            key={t.id}
            href={`/events?tab=${t.id}`}
            role="tab"
            aria-selected={t.id === tab}
            data-testid={`feed-tab-${t.id}`}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${t.id === tab ? "bg-[#e7f3ff] text-fb-blue" : "bg-white text-fb-text"}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2">
        <Link
          href="/queue/start?mode=anything"
          data-testid="queue-anything"
          className="queue-shimmer flex items-center gap-3 overflow-hidden rounded-xl bg-gradient-to-r from-[#1877f2] via-[#5b4bf5] to-[#9333ea] p-4 text-white shadow-md"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/20">
            <Swords size={22} />
          </span>
          <span className="flex-1">
            <span className="block text-xs font-semibold uppercase tracking-wider opacity-80">Queue Up · existing events</span>
            <span className="block font-bold leading-tight">Queue Up for any event this weekend</span>
            <span className="block text-xs opacity-90">We&apos;ll find your squad and sort you into an event you&apos;ll like.</span>
          </span>
        </Link>
        <Link
          href="/queue/start?mode=hangout"
          data-testid="queue-hangout"
          className="flex items-center gap-3 overflow-hidden rounded-xl bg-white p-4 text-fb-text shadow-sm ring-1 ring-[#e4e6eb]"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#e7f3ff] text-fb-blue">
            <Sparkles size={22} />
          </span>
          <span className="flex-1">
            <span className="block text-xs font-semibold uppercase tracking-wider text-fb-blue">Queue Up · new hangout</span>
            <span className="block font-bold leading-tight">Plan a hangout with a new squad</span>
            <span className="block text-xs text-fb-muted">No event needed. We&apos;ll pick a public spot near all of you.</span>
          </span>
        </Link>
      </div>

      <ul className="mt-3 space-y-3 pb-4" data-testid="event-feed" data-count={feed.length}>
        {feed.map((e) => (
          <li key={e.id}>
            <EventCard e={e} squad={squads.has(e.id)} />
          </li>
        ))}
        {feed.length === 0 && <li className="rounded-xl bg-white p-6 text-center text-fb-muted">No events here yet.</li>}
      </ul>
    </div>
  );
}
