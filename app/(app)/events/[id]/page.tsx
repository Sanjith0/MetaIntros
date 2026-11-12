import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock, MapPin, Swords, Users } from "lucide-react";
import { EventCover } from "@/components/EventCover";
import { AvatarStack } from "@/components/Avatar";
import { RsvpButtons } from "@/components/RsvpButtons";
import { SquadBanner } from "@/components/SquadBanner";
import { getEventDetail } from "@/lib/server/events";
import { getCurrentUserId } from "@/lib/server/session";
import { fmtEventWhen } from "@/lib/format";
import { getSquadForEvent } from "@/lib/server/squads";

export default async function EventDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  const e = await getEventDetail(userId, id);
  if (!e) notFound();
  const squad = await getSquadForEvent(userId, id);
  return (
    <div data-testid="event-detail" className="bg-white pb-6">
      <EventCover color={e.coverColor} pattern={e.coverPattern} height={180}>
        <Link href="/events" aria-label="Back" className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/30 text-white">
          <ArrowLeft size={20} />
        </Link>
      </EventCover>
      <div className="space-y-3 p-4">
        <p className="text-sm font-semibold uppercase text-[#e41e3f]">{fmtEventWhen(e.startsAt, e.endsAt)}</p>
        <h1 className="text-2xl font-bold leading-tight" data-testid="event-title">{e.title}</h1>
        <p className="flex items-start gap-2 text-fb-muted">
          <MapPin size={18} className="mt-0.5 shrink-0" />
          <span>
            <span className="font-semibold text-fb-text">{e.venueName}</span>
            <br />
            {e.venueAddress}
          </span>
        </p>
        <p className="flex items-center gap-2 text-fb-muted">
          <Users size={18} /> {e.friendsInterested} friends interested · {e.goingCount} going · hosted by {e.hostName}
        </p>
        {e.friendRsvps.length > 0 && <AvatarStack people={e.friendRsvps} />}

        {squad && <SquadBanner squad={squad} />}

        <RsvpButtons eventId={e.id} initial={e.myRsvp} />

        {e.isPublicVenue ? (
          squad ? null : (
            <Link
              href={`/queue/start?eventId=${e.id}`}
              data-testid="queue-up-button"
              className="queue-shimmer flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#1877f2] to-[#9333ea] py-3.5 text-lg font-bold text-white shadow-lg"
            >
              <Swords size={22} /> Queue Up — go with a squad
            </Link>
          )
        ) : (
          <p data-testid="queue-up-private" className="flex items-center gap-2 rounded-xl bg-fb-bg p-3 text-sm text-fb-muted">
            <Lock size={16} /> Queue Up is only available for events at public venues.
          </p>
        )}

        <section>
          <h2 className="font-bold">About</h2>
          <p className="mt-1 text-fb-text">{e.description}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {e.tagsList.map((t) => (
              <span key={t} className="rounded-full bg-fb-bg px-2.5 py-0.5 text-xs text-fb-muted">#{t}</span>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
