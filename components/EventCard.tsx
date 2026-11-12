import Link from "next/link";
import { MapPin, Users } from "lucide-react";
import { EventCover } from "./EventCover";
import { fmtEventWhen, fmtMonth } from "@/lib/format";

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
}

export function EventCard({ e, squad }: { e: EventCardData; squad?: boolean }) {
  return (
    <Link href={`/events/${e.id}`} data-testid={`event-card-${e.id}`} className="block overflow-hidden rounded-xl bg-white shadow-sm active:scale-[0.99]">
      <EventCover color={e.coverColor} pattern={e.coverPattern} height={110}>
        <div className="absolute left-3 top-3 rounded-lg bg-white px-2 py-1 text-center leading-tight shadow">
          <div className="text-[10px] font-bold text-[#e41e3f]">{fmtMonth(e.startsAt)}</div>
          <div className="text-lg font-bold">{e.startsAt.getDate()}</div>
        </div>
        {squad && (
          <span className="absolute right-3 top-3 rounded-full bg-queue-glow px-2 py-0.5 text-xs font-bold text-white shadow">Your squad is going</span>
        )}
      </EventCover>
      <div className="p-3">
        <p className="text-xs font-semibold uppercase text-[#e41e3f]">{fmtEventWhen(e.startsAt)}</p>
        <h3 className="mt-0.5 font-bold leading-snug">{e.title}</h3>
        <p className="mt-1 flex items-center gap-1 text-sm text-fb-muted">
          <MapPin size={14} /> {e.venueName}
          {e.distanceKm != null && <span>· {e.distanceKm.toFixed(1)} km</span>}
        </p>
        <p className="mt-1 flex items-center gap-1 text-sm text-fb-muted" data-testid="friends-interested">
          <Users size={14} /> {e.friendsInterested} friend{e.friendsInterested === 1 ? "" : "s"} interested · {e.goingCount} going
        </p>
      </div>
    </Link>
  );
}
