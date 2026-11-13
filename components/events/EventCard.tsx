import Link from "next/link";
import { Star, Users } from "lucide-react";
import { RATED_FEED_LABEL_MIN } from "@/lib/match/ratings";
import { eventCoverSrc } from "@/lib/images";
import { EventCover } from "./EventCover";
import { DateLine } from "./DateLine";
import { CardActions } from "./RsvpButtons";

export interface EventCardData {
  id: string;
  title: string;
  startsAt: Date;
  venueName: string;
  coverColor: string;
  coverPattern: string;
  friendsInterested: number;
  goingCount: number;
  distanceKm: number | null;
  myRsvp?: string | null;
  /** from your post-event ratings (see lib/server/events.ts) */
  ratedBoost?: number;
}

/** Facebook-style event card: cover, red date line, title, venue · distance, counts, Interested + share. */
export function EventCard({ e, squad }: { e: EventCardData; squad?: boolean }) {
  return (
    <article className="overflow-hidden rounded-card bg-surface shadow-card">
      <Link href={`/events/${e.id}`} data-testid={`event-card-${e.id}`} className="block">
        <EventCover color={e.coverColor} pattern={e.coverPattern} src={eventCoverSrc(e.id)} label={e.title} className="aspect-[2/1]" />
        <div className="px-3 pt-2.5">
          <DateLine start={e.startsAt} />
          <h3 className="mt-0.5 line-clamp-2 text-title font-semibold">{e.title}</h3>
          <p className="mt-0.5 truncate text-meta text-muted">
            {e.venueName}
            {e.distanceKm != null && ` · ${e.distanceKm.toFixed(1)} km`}
          </p>
          <p className="text-meta text-muted" data-testid="friends-interested">
            {e.friendsInterested > 0 && `${e.friendsInterested} friend${e.friendsInterested === 1 ? "" : "s"} interested · `}
            {e.goingCount} going
          </p>
          {!squad && (e.ratedBoost ?? 0) >= RATED_FEED_LABEL_MIN && (
            <p className="mt-1 flex items-center gap-1 text-meta text-muted" data-testid="rated-reason">
              <Star size={14} aria-hidden /> Like nights you rated highly
            </p>
          )}
          {squad && (
            <p className="mt-1 flex items-center gap-1 text-meta font-semibold text-link">
              <Users size={14} aria-hidden /> Your squad is going
            </p>
          )}
        </div>
      </Link>
      <div className="px-3 pb-3">
        <CardActions eventId={e.id} initial={e.myRsvp ?? null} />
      </div>
    </article>
  );
}
