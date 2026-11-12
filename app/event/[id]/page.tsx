import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FacePile } from "@/components/Avatar";
import { Cover } from "@/components/events/Cover";
import { Description } from "@/components/events/Description";
import { GuestsCard } from "@/components/events/GuestsCard";
import { RsvpButtons } from "@/components/events/RsvpButtons";
import { IconClock, IconDots, IconGlobe, IconMail, IconMapPin, IconShare, IconSparkle, IconTicket, IconUsers } from "@/components/icons";
import { clock12, eventWhen, price } from "@/lib/format";
import { eventView } from "@/lib/server/social";
import { store } from "@/lib/server/store";
import { currentViewerId } from "@/lib/server/viewer";
import { eventImpact, queuePulse } from "@/lib/server/pulse";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: store().events.get(id)?.title ?? "Event" };
}

function durationLabel(start: string, end: string) {
  const toMin = (c: string) => {
    const [h, m] = c.split(":").map(Number) as [number, number];
    return h * 60 + m;
  };
  let d = toMin(end) - toMin(start);
  if (d < 0) d += 24 * 60;
  const h = Math.floor(d / 60);
  const m = d % 60;
  return `${h} hr${h === 1 ? "" : "s"}${m ? ` ${m} min` : ""}`;
}

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await currentViewerId();
  const v = eventView(id, viewer);
  if (!v) notFound();
  const e = v.event;
  const s = store();
  const suggested = [...s.events.values()].filter((x) => x.id !== e.id && x.landmark === e.landmark).slice(0, 3);
  const queued = s.queue.find((q) => q.userId === viewer && q.status === "waiting");
  const partyHere = v.party?.planHere && v.party.status === "locked";
  const impact = eventImpact(e.id);
  const pulse = queuePulse(e.id, viewer, { omitFormed: !!impact });

  return (
    <main data-testid="event-page">
      {/* Ambient header: a colour wash of the cover behind the centred column */}
      <div className="relative bg-white shadow-[var(--shadow-card)]">
        <div className="absolute inset-x-0 top-0 h-[260px] opacity-40 blur-2xl" style={{ background: `linear-gradient(180deg, hsl(${e.coverHue} 70% 70%), transparent)` }} />
        <div className="relative mx-auto max-w-[940px] px-0 sm:px-4">
          <Cover hue={e.coverHue} title={e.title} className="aspect-[2.6/1] w-full" rounded="sm:rounded-b-[8px]" />
          <div className="px-4 pb-3 pt-4 sm:px-0">
            <div className="text-[15px] font-semibold uppercase text-[var(--color-date)]">{eventWhen(e.date, e.start, e.end)}</div>
            <h1 className="mt-1 text-[28px] font-bold leading-tight sm:text-[32px]">{e.title}</h1>
            <div className="mt-1 text-[17px] text-[var(--color-ink-2)]">
              {e.venueName} · {e.city}
            </div>

            {impact && (
              <div className="mt-2 flex items-center gap-1.5 text-[14px] font-semibold text-[var(--color-pq-ink)]" data-testid="event-impact">
                <IconSparkle size={16} className="shrink-0 text-[var(--color-pq)]" /> {impact.text}
              </div>
            )}
            {pulse && !partyHere && (
              <div className="mt-2 flex items-center gap-1.5 text-[14px] font-semibold text-[var(--color-pq-ink)]" data-testid="queue-pulse">
                <IconSparkle size={16} className="shrink-0 text-[var(--color-pq)]" /> {pulse.text}
              </div>
            )}

            {partyHere && v.party && (
              <Link
                href="/party"
                data-testid="party-rsvp-banner"
                className="mt-3 flex items-center gap-3 rounded-[8px] border border-[var(--color-pq)]/30 bg-[var(--color-pq-soft)] px-3 py-2"
              >
                <IconSparkle className="text-[var(--color-pq)]" />
                <FacePile people={v.party.members.map((m) => ({ id: m.id, name: m.name, hue: m.hue }))} size={28} />
                <span className="whitespace-nowrap text-[15px] font-semibold text-[var(--color-pq-ink)]">Your party · 5 going</span>
                <span className="ml-auto hidden text-[12px] font-semibold uppercase tracking-wide text-[var(--color-pq)] sm:inline">Party Queue</span>
              </Link>
            )}
          </div>

          {/* Action bar */}
          <div className="flex flex-col gap-2 border-t border-[var(--color-divider)] px-4 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-0">
            <nav className="flex" aria-label="Event sections">
              <span className="border-b-[3px] border-[var(--color-accent)] px-4 py-3 text-[15px] font-semibold text-[var(--color-accent)]">About</span>
              <span className="px-4 py-3 text-[15px] font-semibold text-[var(--color-ink-2)]">Discussion</span>
            </nav>
            <div className="flex flex-wrap items-center gap-2">
              <RsvpButtons key={`${viewer}-${v.viewerRsvp}`} eventId={e.id} initial={v.viewerRsvp} />
              {e.partyEligible && (
                <Link
                  href={partyHere ? "/party" : `/queue?event=${e.id}`}
                  data-testid="find-my-party"
                  className="press flex h-9 items-center gap-1.5 rounded-[6px] bg-[var(--color-pq)] px-3 text-[15px] font-semibold text-white shadow-[0_0_0_3px_var(--color-pq-soft)] hover:opacity-90"
                >
                  <IconSparkle size={18} /> {partyHere ? "Your party" : queued ? "In the queue" : "Find my party"}
                </Link>
              )}
              <button className="press flex h-9 items-center gap-1.5 rounded-[6px] bg-[var(--color-btn-2)] px-3 text-[15px] font-semibold hover:bg-[var(--color-btn-2-hover)]">
                <IconMail size={18} /> Invite
              </button>
              <button aria-label="Share" className="press flex h-9 w-12 items-center justify-center rounded-[6px] bg-[var(--color-btn-2)] hover:bg-[var(--color-btn-2-hover)]">
                <IconShare size={18} />
              </button>
              <button aria-label="More" className="press flex h-9 w-12 items-center justify-center rounded-[6px] bg-[var(--color-btn-2)] hover:bg-[var(--color-btn-2-hover)]">
                <IconDots size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto grid max-w-[940px] grid-cols-1 gap-4 px-4 py-4 md:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-4">
          <section className="rounded-[8px] bg-white p-4 shadow-[var(--shadow-card)]">
            <h2 className="mb-3 text-[20px] font-bold">Details</h2>
            <ul className="flex flex-col gap-3 text-[15px]">
              <li className="flex items-center gap-3">
                <IconUsers className="text-[var(--color-ink-2)]" />
                {(v.going + v.interested).toLocaleString("en-US")} people responded
              </li>
              <li className="flex items-center gap-3">
                <IconSparkle className="text-[var(--color-ink-2)]" />
                <span>
                  Event by <span className="font-semibold">{e.hostName}</span>
                </span>
              </li>
              <li className="flex items-center gap-3">
                <IconMapPin className="text-[var(--color-ink-2)]" />
                <span className="font-semibold">{e.venueName}</span>
              </li>
              <li className="flex items-center gap-3">
                <IconClock className="text-[var(--color-ink-2)]" />
                Duration: {durationLabel(e.start, e.end)} · ends {clock12(e.end)}
              </li>
              <li className="flex items-center gap-3">
                <IconTicket className="text-[var(--color-ink-2)]" />
                {price(e.priceUsd)}
              </li>
              <li className="flex items-center gap-3">
                <IconGlobe className="text-[var(--color-ink-2)]" />
                Public · Anyone can see this event
              </li>
            </ul>
            <div className="mt-4">
              <Description text={e.description} />
            </div>
            <div className="mt-3 flex gap-2">
              <span className="rounded-[6px] bg-[var(--color-btn-2)] px-3 py-1 text-[13px] font-semibold text-[var(--color-ink-2)]">{e.category}</span>
            </div>
          </section>
          <GuestsCard
            going={v.going}
            interested={v.interested}
            goingPeople={v.goingPeople}
            interestedPeople={v.interestedPeople}
            friendsGoing={v.friendsGoing}
            partyIds={partyHere && v.party ? v.party.members.map((m) => m.id) : []}
          />
        </div>

        <aside className="flex flex-col gap-4">
          <section className="overflow-hidden rounded-[8px] bg-white shadow-[var(--shadow-card)]">
            <div className="relative h-[150px] bg-[#e8eef3]" role="img" aria-label="Map placeholder">
              <div className="absolute inset-0" style={{ backgroundImage: "linear-gradient(#d6dee6 1px, transparent 1px), linear-gradient(90deg, #d6dee6 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
              <div className="absolute left-[30%] top-0 h-full w-3 bg-white/80" />
              <div className="absolute left-0 top-[55%] h-3 w-full bg-white/80" />
              <IconMapPin size={32} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full text-[var(--color-date)]" />
            </div>
            <div className="p-4">
              <div className="text-[17px] font-semibold">{e.venueName}</div>
              <div className="text-[13px] text-[var(--color-ink-2)]">
                Near {e.landmark}, {e.city}
              </div>
            </div>
          </section>
          {suggested.length > 0 && (
            <section className="rounded-[8px] bg-white p-4 shadow-[var(--shadow-card)]">
              <h2 className="mb-2 text-[17px] font-semibold">Suggested events</h2>
              <ul className="flex flex-col gap-2">
                {suggested.map((x) => (
                  <li key={x.id}>
                    <Link href={`/event/${x.id}`} className="flex gap-3 rounded-[8px] p-1 hover:bg-black/5">
                      <Cover hue={x.coverHue} title={x.title} className="h-14 w-14 shrink-0" rounded="rounded-[8px]" />
                      <span className="min-w-0">
                        <span className="block text-[12px] font-semibold uppercase text-[var(--color-date)]">{eventWhen(x.date, x.start)}</span>
                        <span className="block truncate text-[15px] font-semibold">{x.title}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </main>
  );
}
