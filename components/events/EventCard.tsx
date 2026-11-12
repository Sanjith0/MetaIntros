import Link from "next/link";
import type { EventItem } from "@/contracts";
import { eventWhen } from "@/lib/format";
import { Cover } from "./Cover";
import { RsvpButtons } from "./RsvpButtons";

export function EventCard({ e, rsvp, interested, going }: { e: EventItem; rsvp: "interested" | "going" | null; interested: number; going: number }) {
  return (
    <article data-testid={`event-card-${e.id}`} className="flex flex-col overflow-hidden rounded-[8px] bg-white shadow-[var(--shadow-card)]">
      <Link href={`/event/${e.id}`} className="block">
        <Cover hue={e.coverHue} title={e.title} className="aspect-[1.91/1] w-full" />
      </Link>
      <div className="flex flex-1 flex-col gap-0.5 p-3">
        <div className="text-[13px] font-semibold uppercase text-[var(--color-date)]">{eventWhen(e.date, e.start)}</div>
        <Link href={`/event/${e.id}`} className="line-clamp-2 text-[17px] font-semibold leading-[1.18] hover:underline">
          {e.title}
        </Link>
        <div className="truncate text-[13px] text-[var(--color-ink-2)]">{e.venueName}</div>
        <div className="text-[13px] text-[var(--color-ink-2)]">
          {interested.toLocaleString("en-US")} interested · {going.toLocaleString("en-US")} going
        </div>
        <div className="mt-auto pt-2">
          <RsvpButtons eventId={e.id} initial={rsvp} compact />
        </div>
      </div>
    </article>
  );
}
