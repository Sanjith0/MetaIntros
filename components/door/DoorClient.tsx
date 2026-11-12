"use client";

import { useState } from "react";
import type { Card } from "@/contracts";
import { WhyLine } from "@/components/party/WhyLine";
import type { SourceItem } from "@/lib/stage/provenance";
import type { DoorState } from "@/lib/server/meet";
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
  initialMethod = "stub",
  cameraOn = true,
  sourceLabel = "",
  initialDoor = null,
}: {
  partyId: string;
  viewerId: string;
  members: Member[];
  cards: (Card & { why?: SourceItem[] })[];
  initialSpotted: string | null;
  initialMethod?: string;
  cameraOn?: boolean;
  sourceLabel?: string;
  /** F37: running late and where to meet (null when the layer is off). */
  initialDoor?: DoorState | null;
}) {
  const [late, setLate] = useState<Record<string, number>>(initialDoor?.late ?? {});
  const [meet, setMeet] = useState<{ text: string; byName: string } | null>(initialDoor?.meet ?? null);
  const [spot, setSpot] = useState("");
  const [doorMsg, setDoorMsg] = useState<string | null>(null);
  const nameOf = (id: string) => members.find((m) => m.id === id)?.firstName ?? "Someone";
  const tellLate = async (minutes: number) => {
    const r = await fetch("/api/door/late", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ partyId, minutes }) });
    if (r.ok) {
      setLate((l) => ({ ...l, [viewerId]: minutes }));
      setDoorMsg(`You told your party: about ${minutes} minutes late.`);
    } else setDoorMsg(((await r.json()) as { error?: string }).error ?? "Couldn't send.");
  };
  const shareSpot = async () => {
    const r = await fetch("/api/door/meet", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ partyId, text: spot }) });
    if (r.ok) {
      setMeet({ text: spot.replace(/\s+/g, " ").trim(), byName: "You" });
      setSpot("");
      setDoorMsg(null);
    } else setDoorMsg(((await r.json()) as { error?: string }).error ?? "Couldn't send.");
  };
  const [here, setHere] = useState(members.find((m) => m.id === viewerId)?.arrived ?? false);
  const [arrived, setArrived] = useState(() => new Set(members.filter((m) => m.arrived).map((m) => m.id)));
  const [spotted, setSpotted] = useState<{ id: string; method: string } | null>(initialSpotted ? { id: initialSpotted, method: initialMethod } : null);

  useLiveEvents((e) => {
    if (e.type === "member.spotted" && e.payload.viewerId === viewerId && e.payload.partyId === partyId) {
      if (e.payload.subjectId) setSpotted({ id: e.payload.subjectId, method: e.payload.method });
    }
    if (e.type === "member.arrived" && e.payload.partyId === partyId) {
      setArrived((s) => new Set(s).add(e.payload.userId));
      setLate((l) => {
        const n = { ...l };
        delete n[e.payload.userId];
        return n;
      });
    }
    if (e.type === "door.update" && e.payload.partyId === partyId) {
      const p = e.payload;
      if (p.lateMinutes !== null) setLate((l) => ({ ...l, [p.userId]: p.lateMinutes! }));
      if (p.meetSpot) setMeet({ text: p.meetSpot, byName: p.userId === viewerId ? "You" : nameOf(p.userId) });
    }
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
                <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-white/80">
                  {spotted?.method === "tap" ? "You tapped" : "In front of you"}
                  {spotted?.method === "recorded" && (
                    <span className="rounded bg-amber-300 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-black" data-testid="door-recorded">
                      Recorded clip
                    </span>
                  )}
                </div>
                <div className="text-[28px] font-extrabold leading-tight" data-testid="door-card-name">
                  {who.firstName}
                </div>
                <div className="text-[13px] text-white/80">from your party</div>
              </div>
            </div>
            <div className="space-y-3 p-5">
              {card.bridgeLine && <div className="text-[15px] text-[var(--color-ink-2)]">{card.bridgeLine}</div>}
              {card.sharedLine && card.sharedLine !== card.bridgeLine && <div className="text-[17px] font-semibold text-[var(--color-pq-ink)]">{card.sharedLine}</div>}
              <div className="rounded-[10px] bg-[var(--color-pq-soft)] p-3">
                <div className="flex items-center gap-1 text-[12px] font-semibold uppercase tracking-wide text-[var(--color-pq)]">
                  <IconSparkle size={14} /> Say
                </div>
                <div className="text-[19px] font-semibold" data-testid="door-card-opener">
                  “{card.opener}”
                </div>
              </div>
              {card.why ? <WhyLine items={card.why} testid="door-why" /> : <div className="text-[11px] text-[var(--color-ink-2)]">Built from approved facts: {card.sourceIds.join(", ")}</div>}
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

      {initialDoor && (
        <section className="rounded-[12px] bg-white p-4 shadow-[var(--shadow-card)]" data-testid="find-each-other">
          <h2 className="text-[15px] font-semibold">Find each other</h2>
          {meet ? (
            <div className="mt-2 rounded-[8px] bg-[var(--color-pq-soft)] px-3 py-2 text-[15px] font-semibold text-[var(--color-pq-ink)]" data-testid="door-meet">
              Let&apos;s meet: {meet.text}
              <span className="ml-1 text-[12px] font-normal text-[var(--color-ink-2)]">· {meet.byName}</span>
            </div>
          ) : (
            <p className="text-[13px] text-[var(--color-ink-2)]">Nobody has said where to meet yet.</p>
          )}
          <div className="mt-2 flex gap-2">
            <label htmlFor="meet-spot" className="sr-only">
              Where should everyone meet?
            </label>
            <input
              id="meet-spot"
              data-testid="meet-input"
              value={spot}
              maxLength={80}
              onChange={(e) => setSpot(e.target.value)}
              placeholder="Where should everyone meet?"
              className="h-9 min-w-0 flex-1 rounded-[6px] border border-[var(--color-divider)] px-2 text-[15px]"
            />
            <button onClick={shareSpot} disabled={spot.trim().length < 3} data-testid="meet-share" className="press rounded-[6px] bg-[var(--color-pq)] px-3 text-[14px] font-semibold text-white disabled:opacity-50">
              Share
            </button>
          </div>
          {!here && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5" role="group" aria-label="Running late">
              <span className="text-[13px] font-semibold">Running late?</span>
              {[10, 20, 30].map((m) => (
                <button key={m} onClick={() => tellLate(m)} data-testid={`late-${m}`} aria-pressed={late[viewerId] === m} className={`press rounded-full px-2.5 py-1 text-[13px] font-semibold ${late[viewerId] === m ? "bg-[var(--color-pq)] text-white" : "bg-[var(--color-btn-2)]"}`}>
                  {m} min
                </button>
              ))}
            </div>
          )}
          {doorMsg && (
            <p className="mt-1.5 text-[13px] text-[var(--color-ink-2)]" role="status" data-testid="door-msg">
              {doorMsg}
            </p>
          )}
        </section>
      )}

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
                <span className="text-[11px] text-[var(--color-ink-2)]" data-testid={`status-${m.id}`}>
                  {arrived.has(m.id) ? "Here" : late[m.id] ? `~${late[m.id]} min late` : "On the way"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
