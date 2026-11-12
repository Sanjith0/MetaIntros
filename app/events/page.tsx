import type { Metadata } from "next";
import { EventsRail } from "@/components/events/EventsRail";
import { EventCard } from "@/components/events/EventCard";
import { eventView } from "@/lib/server/social";
import { store } from "@/lib/server/store";
import { currentViewerId } from "@/lib/server/viewer";

export const metadata: Metadata = { title: "Events" };
export const dynamic = "force-dynamic";

export default async function EventsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const viewer = await currentViewerId();
  const views = [...store().events.keys()].map((id) => eventView(id, viewer)!);
  const shown = tab === "yours" ? views.filter((v) => v.viewerRsvp || v.party?.planHere) : views;
  const groups = Object.entries(
    shown.reduce<Record<string, typeof shown>>((acc, v) => {
      (acc[v.event.landmark] ??= []).push(v);
      return acc;
    }, {}),
  );

  return (
    <div className="flex">
      <EventsRail active={tab === "yours" ? "yours" : "home"} />
      <main className="min-w-0 flex-1 px-4 py-5 lg:px-8">
        <div className="mx-auto max-w-[1100px]">
          <h2 className="text-[20px] font-bold">{tab === "yours" ? "Your events" : "Upcoming events near you"}</h2>
          <p className="mb-4 text-[15px] text-[var(--color-ink-2)]">
            {tab === "yours" ? "Events you responded to." : "Tap an event, then Find my party to go with five people you'll get along with."}
          </p>
          {shown.length === 0 && <div className="rounded-[8px] bg-white p-6 text-[var(--color-ink-2)] shadow-[var(--shadow-card)]">Nothing here yet.</div>}
          {groups.map(([landmark, vs]) => (
            <section key={landmark} className="mb-6">
              <h3 className="mb-2 text-[17px] font-semibold text-[var(--color-ink-3)]">Near {landmark}</h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {vs.map((v) => (
                  <EventCard key={v.event.id} e={v.event} rsvp={v.viewerRsvp} interested={v.interested} going={v.going} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
