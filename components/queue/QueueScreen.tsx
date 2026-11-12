"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarDays, MapPin, MessageCircle, Radar, Sparkles, X } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { useLiveEvents } from "@/components/useLiveEvents";
import { fmtDuration, fmtEventWhen } from "@/lib/format";
import { MatchTracePanel } from "@/components/trace/MatchTracePanel";

interface Status {
  state: "idle" | "waiting" | "matched";
  targetSize?: number;
  bucketName?: string;
  waitedMs?: number;
  found?: number;
  foundUsers?: { id: string; name: string; avatarColor: string }[];
  partyId?: string | null;
}

interface Party {
  id: string;
  cohesion: number | null;
  rationale: string | null;
  members: { user: { id: string; name: string; avatarColor: string } }[];
  event: { id: string; title: string; startsAt: string; venueName: string } | null;
  landmark: { name: string };
  chat: { id: string } | null;
}

export function QueueScreen() {
  const [status, setStatus] = useState<Status | null>(null);
  const [party, setParty] = useState<Party | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const base = useRef<{ at: number; waited: number } | null>(null);

  const refresh = useCallback(async () => {
    const s: Status = await fetch("/api/queue/status").then((r) => r.json()).catch(() => null);
    if (!s) return;
    setStatus(s);
    if (s.state === "waiting" && s.waitedMs != null && !base.current) base.current = { at: Date.now(), waited: s.waitedMs };
    if (s.state === "matched" && s.partyId) {
      const p = await fetch(`/api/party/${s.partyId}`).then((r) => (r.ok ? r.json() : null));
      if (p) setParty(p);
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(() => {
      if (!party) refresh();
    }, 1200);
    return () => clearInterval(t);
  }, [refresh, party]);

  useEffect(() => {
    const t = setInterval(() => base.current && setElapsed(base.current.waited + Date.now() - base.current.at), 250);
    return () => clearInterval(t);
  }, []);

  useLiveEvents(["queue", "party"], () => {
    if (!party) refresh();
  });

  if (party) return <PartyFound party={party} />;
  if (!status) return <div className="min-h-[80dvh] bg-[#0b1640]" />;
  if (status.state === "idle")
    return (
      <div className="p-6 text-center" data-testid="queue-idle">
        <p>You&apos;re not in a queue.</p>
        <Link href="/events" className="mt-2 inline-block font-semibold text-fb-blue">Browse events</Link>
      </div>
    );

  const n = status.targetSize ?? 6;
  const found = Math.min(status.found ?? 1, n);
  const users = status.foundUsers ?? [];
  const widening = elapsed > 16_000 ? "Expanding search to nearby areas…" : elapsed > 8_000 ? "Widening the match…" : "Looking for your best matches…";

  return (
    <div data-testid="queue-screen" className="relative min-h-[80dvh] overflow-hidden bg-gradient-to-b from-[#0b1640] via-[#1b1464] to-[#2a0f5c] px-4 pb-8 pt-6 text-white">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#a5b4fc]">In queue · {status.bucketName}</p>
        <button type="button" data-testid="leave-queue" aria-label="Leave queue"
          onClick={async () => { await fetch("/api/queue/leave", { method: "POST" }); window.location.href = "/events"; }}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10"><X size={16} /></button>
      </div>

      <div className="relative mx-auto mt-6 flex h-56 w-56 items-center justify-center">
        {[0, 1, 2].map((i) => (
          <span key={i} className="absolute inset-0 rounded-full border-2 border-[#818cf8]/60" style={{ animation: `qu-ping 2.4s ${i * 0.8}s cubic-bezier(0,0,.2,1) infinite` }} />
        ))}
        <span className="absolute inset-6 rounded-full bg-[radial-gradient(circle,rgba(99,102,241,.45),transparent_70%)]" />
        <div className="relative text-center">
          <Radar className="mx-auto animate-pulse text-[#a5b4fc]" size={28} />
          <p className="mt-1 font-mono text-4xl font-black tabular-nums" data-testid="queue-timer">{fmtDuration(elapsed)}</p>
          <p className="text-xs text-[#c7d2fe]">{widening}</p>
        </div>
      </div>

      <p className="mt-6 text-center text-lg font-extrabold" data-testid="players-found">
        Players found: <span className="text-[#67e8f9]">{found}</span>/{n}
      </p>
      <ul className="mx-auto mt-4 flex max-w-xs flex-wrap justify-center gap-3" data-testid="player-slots">
        {Array.from({ length: n }).map((_, i) => {
          const u = users[i];
          return (
            <li key={u?.id ?? `empty-${i}`} className="flex w-14 flex-col items-center gap-1">
              {u ? (
                <span className="animate-[qu-pop_.4s_ease-out] rounded-full shadow-[0_0_16px_rgba(103,232,249,.7)]" data-testid="player-filled">
                  <Avatar name={u.name} color={u.avatarColor} size={52} />
                </span>
              ) : (
                <span className="h-[52px] w-[52px] animate-pulse rounded-full border-2 border-dashed border-white/30" data-testid="player-empty" />
              )}
              <span className="w-full truncate text-center text-[10px] text-[#c7d2fe]">{u ? (i === 0 ? "You" : u.name.split(" ")[0]) : "…"}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PartyFound({ party }: { party: Party }) {
  return (
    <div data-testid="party-found" className="relative min-h-[80dvh] overflow-hidden bg-gradient-to-b from-[#0b1640] via-[#3b0f7a] to-[#6d28d9] px-4 pb-8 pt-8 text-white">
      <div className="pointer-events-none absolute inset-0">
        {Array.from({ length: 18 }).map((_, i) => (
          <span key={i} className="absolute h-2 w-2 rounded-sm" style={{ left: `${(i * 37) % 100}%`, top: -10, background: ["#67e8f9", "#f0abfc", "#fde047", "#86efac"][i % 4], animation: `qu-fall ${2 + (i % 5) * 0.4}s ${(i % 7) * 0.15}s ease-in forwards` }} />
        ))}
      </div>
      <p className="text-center text-xs font-semibold uppercase tracking-[0.3em] text-[#c4b5fd]">Match complete</p>
      <h1 className="mt-1 animate-[qu-pop_.5s_ease-out] text-center text-4xl font-black drop-shadow-[0_0_20px_rgba(168,85,247,.9)]">Party found!</h1>
      <ul className="mt-6 flex flex-wrap justify-center gap-3" data-testid="party-members">
        {party.members.map((m) => (
          <li key={m.user.id} className="flex w-16 flex-col items-center gap-1">
            <Avatar name={m.user.name} color={m.user.avatarColor} size={56} ring />
            <span className="w-full truncate text-center text-xs">{m.user.name.split(" ")[0]}</span>
          </li>
        ))}
      </ul>
      {party.event && (
        <div className="mt-6 rounded-2xl bg-white/10 p-4 backdrop-blur" data-testid="party-event">
          <p className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-[#c4b5fd]"><Sparkles size={14} /> Your squad is going to</p>
          <p className="mt-1 text-lg font-bold">{party.event.title}</p>
          <p className="flex items-center gap-1.5 text-sm text-[#ddd6fe]"><CalendarDays size={14} /> {fmtEventWhen(new Date(party.event.startsAt))}</p>
          <p className="flex items-center gap-1.5 text-sm text-[#ddd6fe]"><MapPin size={14} /> {party.event.venueName}</p>
        </div>
      )}
      <MatchTracePanel partyId={party.id} dark />
      <div className="mt-5 grid grid-cols-2 gap-2">
        {party.chat && (
          <Link href={`/chats/${party.chat.id}`} data-testid="open-squad-chat" className="flex items-center justify-center gap-1.5 rounded-xl bg-white py-3 font-bold text-[#5b21b6]">
            <MessageCircle size={18} /> Squad chat
          </Link>
        )}
        {party.event && (
          <Link href={`/events/${party.event.id}`} data-testid="view-event" className={`flex items-center justify-center gap-1.5 rounded-xl bg-white/15 py-3 font-bold ${party.chat ? "" : "col-span-2"}`}>
            <CalendarDays size={18} /> View event
          </Link>
        )}
      </div>
    </div>
  );
}
