import { notFound } from "next/navigation";
import { Flag, Globe, Lock, MapPin, MapPinned, Users } from "lucide-react";
import { TopBar } from "@/components/fb/TopBar";
import { FacePile, IconCircle, Section, Stack } from "@/components/fb";
import { EventCover } from "@/components/events/EventCover";
import { DateLine } from "@/components/events/DateLine";
import { ActionRow } from "@/components/events/RsvpButtons";
import { QueueEntry } from "@/components/queueup/QueueEntry";
import { StatusCard } from "@/components/queueup/StatusCard";
import { FriendQueues } from "@/components/queueup/FriendQueues";
import { listFriendQueues } from "@/lib/server/friendQueues";
import { getCurrentUser } from "@/lib/server/session";
import { prisma } from "@/lib/db";
import { getEventDetail } from "@/lib/server/events";
import { getCurrentUserId } from "@/lib/server/session";
import { now } from "@/lib/server/clock";
import { getStatusCard } from "@/lib/server/status";
import { pulseLine, queuePulse } from "@/lib/server/pulse";

function DetailRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 py-1.5">
      <span className="mt-0.5 shrink-0 text-muted" aria-hidden>{icon}</span>
      <span className="min-w-0 text-body">{children}</span>
    </li>
  );
}

export default async function EventDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  const e = await getEventDetail(userId, id);
  if (!e) notFound();
  const hangout = e.kind === "hangout";
  const t = await now();
  const [card, pulse, landmarks, friendQueues, me] = await Promise.all([
    getStatusCard(userId, t, id),
    queuePulse(id),
    prisma.landmark.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, city: true } }),
    e.kind === "hangout" ? Promise.resolve([]) : listFriendQueues(userId, { eventId: id }),
    getCurrentUser(),
  ]);
  const friendsGoing = e.friendRsvps.filter((f) => f.status === "going").length;

  return (
    <div data-testid="event-detail">
      <TopBar back="/events" title={e.title} />
      <Stack>
        <div className="bg-surface pb-3">
          <EventCover color={e.coverColor} pattern={e.coverPattern} className="aspect-[2/1]" />
          <div className="px-4 pt-3">
            <DateLine start={e.startsAt} end={e.endsAt} />
            <h1 className="mt-1 text-page font-bold" data-testid="event-title">{e.title}</h1>
            <p className="mt-1 text-body text-muted">{e.venueName}</p>
            {!hangout && <p className="text-meta text-muted">Event by {e.hostName}</p>}
          </div>
          {!hangout && (
            <div className="mt-3 px-4">
              <ActionRow eventId={e.id} initial={e.myRsvp} />
            </div>
          )}
        </div>

        {hangout ? (
          <p data-testid="hangout-badge" className="flex items-start gap-3 bg-surface px-4 py-3 text-body">
            <IconCircle tone="on"><MapPinned size={18} /></IconCircle>
            <span>A hangout Queue Up planned for your squad, at a public spot near all of you. Only your squad can see it.</span>
          </p>
        ) : null}

        {card ? (
          <StatusCard card={card} />
        ) : hangout ? null : e.isPublicVenue ? (
          <QueueEntry
            pulse={pulseLine(pulse)}
            event={{ id: e.id, title: e.title, startsAt: e.startsAt.toISOString(), venue: e.venueName, isPublic: e.isPublicVenue }}
            landmarks={landmarks}
            shareDefault={me.queueVisibility === "friends"}
            friendsInLine={friendQueues.filter((q) => q.state === "waiting").length}
          />
        ) : (
          <p data-testid="queue-up-private" className="flex items-center gap-2 bg-surface px-4 py-3 text-meta text-muted">
            <Lock size={16} aria-hidden /> Queue Up only works for events at public venues.
          </p>
        )}

        {!hangout && <FriendQueues queues={friendQueues} variant="list" nowMs={t.getTime()} eventTitle={e.title} />}

        <Section title="Details">
          <ul>
            {!hangout && <DetailRow icon={<Users size={20} />}>{e.goingCount + e.interestedCount} people responded</DetailRow>}
            {!hangout && <DetailRow icon={<Flag size={20} />}>Event by <span className="font-semibold">{e.hostName}</span></DetailRow>}
            <DetailRow icon={<MapPin size={20} />}>
              <span className="font-semibold">{e.venueName}</span>
              <span className="block text-meta text-muted">{e.venueAddress}</span>
            </DetailRow>
            <DetailRow icon={hangout ? <Lock size={20} /> : <Globe size={20} />}>{hangout ? "Private · Only your squad" : e.isPublicVenue ? "Public · Anyone can see this event" : "Public event at a private venue"}</DetailRow>
          </ul>
          <p className="mt-2 text-body">{e.description}</p>
          {e.tagsList.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {e.tagsList.map((t) => (
                <li key={t} className="rounded-btn bg-control px-2.5 py-1 text-meta font-semibold">{t.replace(/[-_]/g, " ")}</li>
              ))}
            </ul>
          )}
        </Section>

        {!hangout && (
          <Section title="Guests" className="pb-4">
            <div className="grid grid-cols-2 text-center">
              <div>
                <p className="text-headline font-bold">{e.goingCount}</p>
                <p className="text-meta text-muted">Going</p>
              </div>
              <div>
                <p className="text-headline font-bold">{e.interestedCount}</p>
                <p className="text-meta text-muted">Interested</p>
              </div>
            </div>
            {e.friendRsvps.length > 0 && (
              <div className="mt-3 flex items-center gap-2" data-testid="friend-rsvps">
                <FacePile people={e.friendRsvps} size={32} max={5} />
                <span className="text-meta text-muted">
                  {e.friendRsvps[0].name.split(" ")[0]}
                  {e.friendRsvps.length > 1 ? ` and ${e.friendRsvps.length - 1} other friend${e.friendRsvps.length > 2 ? "s" : ""}` : ""}
                  {friendsGoing === e.friendRsvps.length ? " going" : " interested"}
                </span>
              </div>
            )}
          </Section>
        )}
      </Stack>
    </div>
  );
}
