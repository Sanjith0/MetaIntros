import { prisma } from "@/lib/db";
import { QueueSetup } from "@/components/queue/QueueSetup";
import { fmtEventWhen } from "@/lib/format";

export default async function QueueStart({ searchParams }: { searchParams: Promise<{ eventId?: string; mode?: string }> }) {
  const sp = await searchParams;
  const event = sp.eventId ? await prisma.event.findUnique({ where: { id: sp.eventId } }) : null;
  const landmarks = await prisma.landmark.findMany({ orderBy: { name: "asc" } });
  return (
    <QueueSetup
      event={event ? { id: event.id, title: event.title, when: fmtEventWhen(event.startsAt), venue: event.venueName, isPublic: event.isPublicVenue } : null}
      landmarks={landmarks.map((l) => ({ id: l.id, name: l.name, city: l.city }))}
    />
  );
}
