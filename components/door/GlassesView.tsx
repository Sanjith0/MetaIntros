"use client";

import Link from "next/link";
import { useState } from "react";
import type { Card } from "@/contracts";
import { useLiveEvents } from "@/components/live/LiveProvider";

interface Member {
  id: string;
  firstName: string;
}

/**
 * A heads-up view for glasses, on the same Spotted contract as the door.
 * One name, one shared thing, one line to say. Nothing about the person's
 * face or looks: only what both people approved.
 */
export function GlassesView({
  partyId,
  viewerId,
  members,
  cards,
  sourceLabel,
  initial,
}: {
  partyId: string;
  viewerId: string;
  members: Member[];
  cards: Card[];
  sourceLabel: string;
  initial: { id: string; method: string } | null;
}) {
  const [spotted, setSpotted] = useState(initial);
  const [seen, setSeen] = useState<string[]>(initial ? [initial.id] : []);

  useLiveEvents((e) => {
    if (e.type !== "member.spotted" || e.payload.viewerId !== viewerId || e.payload.partyId !== partyId || !e.payload.subjectId) return;
    const id = e.payload.subjectId;
    setSpotted({ id, method: e.payload.method });
    setSeen((s) => (s.includes(id) ? s : [...s, id]));
  });

  const card = spotted ? cards.find((c) => c.subjectId === spotted.id) : undefined;
  const who = spotted ? members.find((m) => m.id === spotted.id) : undefined;

  return (
    <div className="fixed inset-0 z-[45] overflow-hidden bg-[radial-gradient(ellipse_at_center,#1b1d29_0%,#07080c_70%)] text-white" data-testid="glasses">
      {/* Lens frame */}
      <div className="pointer-events-none absolute inset-3 rounded-[48px] border border-white/10 sm:inset-6" />
      <div className="absolute left-6 right-6 top-6 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50 sm:left-10 sm:right-10 sm:top-9">
        <span>Party Queue · Glasses</span>
        <span className="flex items-center gap-2">
          {spotted?.method === "recorded" && (
            <span className="flex items-center gap-1 rounded bg-amber-300 px-1.5 py-0.5 text-[10px] font-bold text-black" data-testid="glasses-recorded">
              ● Recorded clip
            </span>
          )}
          <span className="hidden normal-case tracking-normal sm:inline">{sourceLabel}</span>
        </span>
      </div>

      {/* Reticle */}
      <div className="pointer-events-none absolute left-1/2 top-[34%] h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/15" />

      {card && who ? (
        <div className="match-pop absolute bottom-10 left-1/2 w-[min(560px,calc(100%-48px))] -translate-x-1/2 rounded-[22px] bg-white/[0.08] px-6 py-5 ring-1 ring-white/15 backdrop-blur-md" data-testid="glasses-hud" key={who.id}>
          <div className="text-[13px] font-semibold uppercase tracking-[0.18em] text-violet-200/80">In front of you</div>
          <div className="text-[44px] font-extrabold leading-none tracking-tight" data-testid="glasses-name">
            {who.firstName}
          </div>
          {card.sharedLine && card.sharedLine !== card.bridgeLine && <div className="mt-2 text-[18px] text-white/80">{card.sharedLine}</div>}
          {card.bridgeLine && <div className="mt-1 text-[14px] text-white/55">{card.bridgeLine}</div>}
          <div className="mt-3 rounded-[12px] bg-violet-400/15 px-3 py-2 text-[20px] font-semibold text-violet-50" data-testid="glasses-say">
            “{card.opener}”
          </div>
        </div>
      ) : (
        <div className="absolute bottom-14 left-1/2 -translate-x-1/2 text-center text-[16px] text-white/45" data-testid="glasses-idle">
          Looking for your party…
        </div>
      )}

      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2" aria-label="Who you've seen">
        {members
          .filter((m) => m.id !== viewerId)
          .map((m) => (
            <span key={m.id} title={m.firstName} className={`h-1.5 w-6 rounded-full ${seen.includes(m.id) ? "bg-violet-300" : "bg-white/15"}`} />
          ))}
      </div>
      <Link href="/door" className="absolute right-6 top-14 text-[12px] font-semibold text-white/50 hover:text-white sm:right-10">
        Phone view
      </Link>
      <span className="absolute bottom-4 right-6 text-[10px] font-semibold uppercase tracking-wide text-white/30">Hackathon prototype, not Facebook</span>
    </div>
  );
}
