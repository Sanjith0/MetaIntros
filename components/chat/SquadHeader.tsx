"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarDays, Clock, MapPin } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { MatchTracePanel } from "@/components/trace/MatchTracePanel";
import { fmtDuration, fmtEventWhen } from "@/lib/format";
import type { SquadHeaderInfo } from "@/lib/server/squadChat";

export type SquadHeaderData = SquadHeaderInfo;

export function SquadHeader({ squad, meId, children }: { squad: SquadHeaderData; meId: string; children?: React.ReactNode }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const start = new Date(squad.event.startsAt);
  return (
    <div data-testid="squad-header" className="border-b border-[#e9e3ff] bg-gradient-to-b from-[#f6f3ff] to-white px-3 pb-3 pt-2">
      <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-[#e9e3ff]">
        <Link href={`/events/${squad.event.id}`} className="block font-bold leading-tight" data-testid="squad-header-event">{squad.event.title}</Link>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-fb-muted" data-testid="squad-header-time"><CalendarDays size={14} /> {fmtEventWhen(start, new Date(squad.event.endsAt))}</p>
        <p className="mt-0.5 flex items-start gap-1.5 text-sm text-fb-muted" data-testid="squad-header-spot">
          <MapPin size={14} className="mt-0.5 shrink-0 text-[#e41e3f]" />
          <span><span className="font-semibold text-fb-text">Meet: {squad.meetingSpot}</span><br />{squad.event.venueAddress} · public venue</span>
        </p>
        <div className="mt-2 flex items-center justify-between">
          <ul className="flex -space-x-2" data-testid="squad-header-members">
            {squad.members.map((m) => (
              <li key={m.id}>
                <Link href={m.id === meId ? "#" : `/squad/${squad.partyId}/cards?member=${m.id}`} data-testid={`member-avatar-${m.id}`} aria-label={`Talk card for ${m.name}`}>
                  <Avatar name={m.name} color={m.avatarColor} photoUrl={m.photoUrl} size={34} ring />
                </Link>
              </li>
            ))}
          </ul>
          <Link href={`/squad/${squad.partyId}/cards`} data-testid="open-talk-cards" className="rounded-full bg-queue-glow px-3 py-1 text-xs font-bold text-white">Talk cards</Link>
        </div>
        {squad.expiresAt && now != null && (
          <p className="mt-2 flex items-center gap-1 text-[11px] text-fb-muted" data-testid="squad-header-expiry">
            <Clock size={11} /> {squad.archived ? "Chat ended" : `Chat expires in ${fmtDuration(new Date(squad.expiresAt).getTime() - now)} · 24h after the event`}
          </p>
        )}
        {children}
      </div>
      <MatchTracePanel partyId={squad.partyId} defaultOpen={false} />
    </div>
  );
}
