import { prisma } from "@/lib/db";
import { TopBar } from "@/components/fb/TopBar";
import { QueueSetup } from "@/components/queue/QueueSetup";

/** Full-page version of the setup step (deep links, tests). The sheet on the event page is the main way in. */
export default async function QueueStart({ searchParams }: { searchParams: Promise<{ eventId?: string; mode?: string }> }) {
  const sp = await searchParams;
  const found = sp.eventId ? await prisma.event.findUnique({ where: { id: sp.eventId } }) : null;
  const event = found?.kind === "event" ? found : null; // you can't queue into a squad's private hangout
  const landmarks = await prisma.landmark.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, city: true } });
  return (
    <div>
      <TopBar back={event ? `/events/${event.id}` : "/events"} title="Find a squad" />
      <QueueSetup
        mode={sp.mode === "hangout" ? "hangout" : "events"}
        event={event ? { id: event.id, title: event.title, startsAt: event.startsAt.toISOString(), venue: event.venueName, isPublic: event.isPublicVenue } : null}
        landmarks={landmarks}
      />
    </div>
  );
}
