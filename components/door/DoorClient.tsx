"use client";

import { useState } from "react";
import type { Card } from "@/contracts";
import { Avatar } from "@/components/Avatar";
import { IconCheck, IconDoor, IconSparkle } from "@/components/icons";
import { useLiveEvents } from "@/components/live/LiveProvider";

interface Member {
  id: string;
  name: string;
  firstName: string;
  hue: number;
  arrived: boolean;
}

/** At the door: "I'm here", the card for whoever is spotted, and a
 *  tap-a-face list. The card says who is in front of you and what to say.
 *  Nothing on it is inferred from a face. */
export function DoorClient({
  partyId,
  viewerId,
  members,
  cards,
  initialSpotted,
  cameraOn = true,
  sourceLabel = "",
}: {
  partyId: string;
  viewerId: string;
  members: Member[];
  cards: Card[];
  initialSpotted: string | null;
  cameraOn?: boolean;
  sourceLabel?: string;
}) {
  const [here, setHere] = useState(members.find((m) => m.id === viewerId)?.arrived ?? false);
  const [arrived, setArrived] = useState(() => new Set(members.filter((m) => m.arrived).map((m) => m.id)));
  const [spotted, setSpotted] = useState<{ id: string; method: string } | null>(initialSpotted ? { id: initialSpotted, method: "stub" } : null);

  useLiveEvents((e) => {
    if (e.type === "member.spotted" && e.payload.viewerId === viewerId && e.payload.partyId === partyId) {
      if (e.payload.subjectId) setSpotted({ id: e.payload.subjectId, method: e.payload.method });
    }
    if (e.type === "member.arrived" && e.payload.partyId === partyId) setArrived((s) => new Set(s).add(e.payload.userId));
  });

  const imHere = async () => {
    const res = await fetch("/api/door/arrive", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ partyId }) });
    if (res.ok) {
      setHere(true);
      setArrived((s) => new Set(s).add(viewerId));
    }
  };

  const tap = async (subjectId: string) => {
    setSpotted({ id: subjectId, method: "tap" });
    await fetch("/api/door/tap", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ partyId, subjectId }) });
  };

  const others = members.filter((m) => m.id !== viewerId);
  const card = spotted ? cards.find((c) => c.subjectId === spotted.id) : undefined;
  const who = spotted ? members.find((m) => m.id === spotted.id) : undefined;

  return (
    <div className="flex flex-col gap-4">
      <button
        data-testid="im-here"
        onClick={imHere}
        disabled={here}
        className={`press flex h-14 items-center justify-center gap-2 rounded-[12px] text-[17px] font-bold ${here ? "bg-[var(--color-on-bg)] text-[var(--color-on-ink)]" : "bg-[var(--color-pq)] text-white shadow-[var(--shadow-elevated)]"}`}
      >
        {here ? (
          <>
            <IconCheck /> You're here. Your party can see that.
          </>
        ) : (
          <>
            <IconDoor /> I'm here
          </>
        )}
      </button>

      <section className="overflow-hidden rounded-[12px] bg-white shadow-[var(--shadow-card)]" data-testid="door-card">
        {card && who ? (
          <div className="match-pop">
            <div className="flex items-center gap-4 bg-gradient-to-br from-[var(--color-pq)] to-[var(--color-pq-2)] px-5 py-5 text-white">
              <Avatar name={who.name} hue={who.hue} size={64} />
              <div>
                <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-white/80">{spotted?.method === "tap" ? "You tapped" : "In front of you"}</div>
                <div className="text-[28px] font-extrabold leading-tight" data-testid="door-card-name">
                  {who.firstName}
                </div>
                <div className="text-[13px] text-white/80">from your party</div>
              </div>
            </div>
            <div className="space-y-3 p-5">
              {card.bridgeLine && <div className="text-[15px] text-[var(--color-ink-2)]">{card.bridgeLine}</div>}
              {card.sharedLine && <div className="text-[17px] font-semibold text-[var(--color-pq-ink)]">{card.sharedLine}</div>}
              <div className="rounded-[10px] bg-[var(--color-pq-soft)] p-3">
                <div className="flex items-center gap-1 text-[12px] font-semibold uppercase tracking-wide text-[var(--color-pq)]">
                  <IconSparkle size={14} /> Say
                </div>
                <div className="text-[19px] font-semibold" data-testid="door-card-opener">
                  “{card.opener}”
                </div>
              </div>
              <div className="text-[11px] text-[var(--color-ink-2)]">Built from approved facts: {card.sourceIds.join(", ")}</div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 px-5 py-10 text-center text-[var(--color-ink-2)]">
            <IconDoor size={32} />
            <div className="text-[17px] font-semibold text-[var(--color-ink)]">Waiting for your party</div>
            <div className="text-[13px]" data-testid="door-camera-state">
              {cameraOn ? "When the door camera spots someone from your party, their card shows here. Or tap a face below." : "The door camera is off. Tap a face below to see who's in front of you."}
            </div>
            {sourceLabel && <div className="mt-1 rounded-full bg-[var(--color-wash)] px-2.5 py-0.5 text-[11px] font-semibold">Frame source: {sourceLabel}</div>}
          </div>
        )}
      </section>

      <section className="rounded-[12px] bg-white p-4 shadow-[var(--shadow-card)]">
        <h2 className="text-[15px] font-semibold">Tap a face</h2>
        <p className="mb-3 text-[13px] text-[var(--color-ink-2)]">Who's in front of you?</p>
        <ul className="grid grid-cols-4 gap-2" data-testid="tap-faces">
          {others.map((m) => (
            <li key={m.id}>
              <button
                onClick={() => tap(m.id)}
                data-testid={`tap-${m.id}`}
                className={`press flex w-full flex-col items-center gap-1 rounded-[10px] p-2 hover:bg-black/5 ${spotted?.id === m.id ? "bg-[var(--color-pq-soft)] ring-2 ring-[var(--color-pq)]" : ""}`}
              >
                <span className="relative">
                  <Avatar name={m.name} hue={m.hue} size={52} />
                  {arrived.has(m.id) && <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-white bg-[var(--color-positive)]" title="Here" />}
                </span>
                <span className="text-[13px] font-semibold">{m.firstName}</span>
                <span className="text-[11px] text-[var(--color-ink-2)]">{arrived.has(m.id) ? "Here" : "On the way"}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
