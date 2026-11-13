"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CalendarDays, Check, Hourglass, Images, MapPin, MessageCircle, UserPlus } from "lucide-react";
import { ButtonLink, FacePile, IconCircle } from "@/components/fb";
import { useLiveEvents } from "@/components/useLiveEvents";
import { fmtDuration, fmtEventWhen } from "@/lib/format";
import type { StatusCard as Card } from "@/lib/server/status";

/**
 * The single Queue Up status card. One state, one line of context, one next action.
 * Waiting ticks its own timer; every state refreshes when the queue or squad changes.
 */
export function StatusCard({ card }: { card: Card }) {
  const router = useRouter();
  const [elapsed, setElapsed] = useState(card.state === "waiting" ? card.waitedMs : 0);
  const base = useRef({ at: 0, waited: card.state === "waiting" ? card.waitedMs : 0 });
  useEffect(() => {
    if (card.state !== "waiting") return;
    base.current = { at: Date.now(), waited: card.waitedMs };
    const t = setInterval(() => setElapsed(base.current.waited + Date.now() - base.current.at), 1000);
    return () => clearInterval(t);
  }, [card]);
  useLiveEvents(["queue", "party"], () => router.refresh());

  if (card.state === "waiting") {
    const pct = Math.round((card.found / card.targetSize) * 100);
    return (
      <section data-testid="status-card" data-status="waiting" className="bg-surface px-4 py-3">
        <div className="flex items-center gap-3">
          <IconCircle tone="on" size={40}><Hourglass size={20} /></IconCircle>
          <div className="min-w-0 flex-1">
            <p className="text-body font-semibold">Finding your squad</p>
            <p className="truncate text-meta text-muted">
              {card.title} · {card.found} of {card.targetSize} found{card.bucketName ? ` near ${card.bucketName}` : ""}
            </p>
          </div>
          <span className="text-meta text-muted tabular-nums" aria-label="Time in queue">{fmtDuration(elapsed)}</span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-control" role="progressbar" aria-valuemin={0} aria-valuemax={card.targetSize} aria-valuenow={card.found} aria-label="Squad found so far">
          <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
        <ButtonLink href={card.action.href} variant="primary" block className="mt-3" data-testid="status-action">{card.action.label}</ButtonLink>
      </section>
    );
  }

  if (card.state === "accept") {
    return (
      <section data-testid="status-card" data-status="accept" className="bg-surface px-4 py-3">
        <div className="flex items-center gap-3">
          <IconCircle tone="on" size={40}><Check size={20} /></IconCircle>
          <div className="min-w-0 flex-1">
            <p className="text-body font-semibold">{card.accepted ? "You're in" : "We found your squad"}</p>
            <p className="truncate text-meta text-muted">{card.title} · {card.inCount} of {card.size} in</p>
          </div>
        </div>
        <ButtonLink href={card.action.href} variant="primary" block className="mt-3" data-testid="status-action">{card.action.label}</ButtonLink>
      </section>
    );
  }

  const when = fmtEventWhen(new Date(card.startsAt));
  const sharing = card.state === "after" && card.action.href.endsWith("/share");
  const copy = {
    ready: { title: `Your squad is going to ${card.title}`, sub: `${when} · ${card.faces.length} people`, Icon: CalendarDays },
    venue: { title: card.checkedIn ? "You're checked in" : `${card.title} is starting`, sub: `Meet at the front entrance · ${card.venueName}`, Icon: MapPin },
    after: sharing
      ? { title: `How was ${card.title}?`, sub: "Share photos from your squad album, or skip it.", Icon: Images }
      : { title: `How was ${card.title}?`, sub: "Add the people you'd like to see again. Only mutual adds become friends.", Icon: UserPlus },
  }[card.state];
  // The button's icon names its action (open the chat), not the card's state (a date).
  const ActionIcon = card.action.href.startsWith("/chats/") ? MessageCircle : copy.Icon;

  return (
    <section data-testid="squad-banner" data-status={card.state} className="bg-surface px-4 py-3">
      <div className="flex items-center gap-3">
        <FacePile people={card.faces} size={32} max={4} />
        <div className="min-w-0 flex-1">
          <p className="text-body font-semibold leading-snug">{copy.title}</p>
          <p className="text-meta text-muted">{copy.sub}</p>
        </div>
      </div>
      <ButtonLink href={card.action.href} variant="primary" block className="mt-3" data-testid="status-action" icon={<ActionIcon size={16} />}>
        {card.action.label}
      </ButtonLink>
      {card.secondary && (
        <Link href={card.secondary.href} className="mt-2 flex h-9 items-center justify-center text-body font-semibold text-link" data-testid="status-secondary">
          {card.secondary.label}
        </Link>
      )}
    </section>
  );
}
