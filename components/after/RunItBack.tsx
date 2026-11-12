"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { IconLock, IconSparkle } from "@/components/icons";
import { useLiveEvents } from "@/components/live/LiveProvider";

interface Member {
  id: string;
  name: string;
  firstName: string;
  hue: number;
}

/** Private picks; only mutual picks are shown, one pair at a time. */
export function RunItBack({ partyId, viewerId, members, initial }: { partyId: string; viewerId: string; members: Member[]; initial: { submitted: boolean; myPicks: string[]; mutual: string[] } }) {
  const [picks, setPicks] = useState<Set<string>>(new Set(initial.myPicks));
  const [submitted, setSubmitted] = useState(initial.submitted);
  const [mutual, setMutual] = useState<string[]>(initial.mutual);
  const [revealed, setRevealed] = useState(0);
  const [saving, setSaving] = useState(false);

  useLiveEvents((e) => {
    if (e.type !== "runitback.mutual" || e.payload.partyId !== partyId) return;
    const other = e.payload.a === viewerId ? e.payload.b : e.payload.a;
    setMutual((m) => (m.includes(other) ? m : [...m, other]));
  });

  // Reveal pair by pair.
  useEffect(() => {
    if (!submitted || revealed >= mutual.length) return;
    const t = setTimeout(() => setRevealed((n) => n + 1), revealed === 0 ? 400 : 1100);
    return () => clearTimeout(t);
  }, [submitted, revealed, mutual.length]);

  const save = async () => {
    setSaving(true);
    const res = await fetch("/api/runitback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ partyId, pickedIds: [...picks] }) });
    setSaving(false);
    if (!res.ok) return;
    const { view } = (await res.json()) as { view: { mutual: string[] } };
    setMutual(view.mutual);
    setSubmitted(true);
  };

  const others = members.filter((m) => m.id !== viewerId);
  const byId = Object.fromEntries(members.map((m) => [m.id, m]));

  if (!submitted) {
    return (
      <section className="rounded-[12px] bg-white p-5 shadow-[var(--shadow-card)]" data-testid="runitback-picks">
        <h2 className="text-[20px] font-bold">Who would you go out with again?</h2>
        <p className="mt-1 flex items-start gap-1.5 text-[13px] text-[var(--color-ink-2)]">
          <IconLock size={16} className="mt-0.5 shrink-0" /> Nobody sees your picks. If two people pick each other, both of them find out. Nobody else does, and nobody learns who didn't pick them.
        </p>
        <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {others.map((m) => {
            const on = picks.has(m.id);
            return (
              <li key={m.id}>
                <button
                  data-testid={`pick-${m.id}`}
                  aria-pressed={on}
                  onClick={() =>
                    setPicks((s) => {
                      const n = new Set(s);
                      if (n.has(m.id)) n.delete(m.id);
                      else n.add(m.id);
                      return n;
                    })
                  }
                  className={`press flex w-full flex-col items-center gap-2 rounded-[12px] border-2 p-3 ${on ? "border-[var(--color-pq)] bg-[var(--color-pq-soft)]" : "border-transparent bg-[var(--color-wash)] hover:bg-[var(--color-btn-2)]"}`}
                >
                  <Avatar name={m.name} hue={m.hue} size={56} />
                  <span className="text-[15px] font-semibold">{m.firstName}</span>
                  <span className={`text-[12px] font-semibold ${on ? "text-[var(--color-pq)]" : "text-[var(--color-ink-2)]"}`}>{on ? "Yes, again" : "Tap to pick"}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <button data-testid="save-picks" onClick={save} disabled={saving} className="press mt-5 h-10 w-full rounded-[6px] bg-[var(--color-pq)] text-[15px] font-semibold text-white disabled:opacity-50">
          {saving ? "Saving…" : "Save my picks privately"}
        </button>
      </section>
    );
  }

  return (
    <section className="rounded-[12px] bg-white p-5 shadow-[var(--shadow-card)]" data-testid="runitback-results">
      <h2 className="text-[20px] font-bold">Your picks are saved</h2>
      <p className="mt-1 text-[13px] text-[var(--color-ink-2)]">Only mutual picks show up here, one at a time, and only for the two people in them.</p>
      <ul className="mt-4 flex flex-col gap-3">
        {mutual.slice(0, revealed).map((id) => {
          const m = byId[id];
          if (!m) return null;
          return (
            <li key={id} data-testid={`mutual-${id}`} className="match-pop flex items-center gap-3 rounded-[12px] bg-gradient-to-br from-[var(--color-pq)] to-[var(--color-pq-2)] p-4 text-white">
              <IconSparkle />
              <Avatar name={m.name} hue={m.hue} size={48} />
              <div>
                <div className="text-[17px] font-bold">You and {m.firstName} both said yes</div>
                <div className="text-[13px] text-white/85">Run it back: plan something together.</div>
              </div>
            </li>
          );
        })}
      </ul>
      {revealed >= mutual.length && (
        <p className="mt-4 text-[13px] text-[var(--color-ink-2)]" data-testid="runitback-done">
          {mutual.length === 0 ? "No mutual picks yet. If someone you picked picks you back, you'll both get a notification." : "That's everyone so far. More can appear as others save their picks."}
        </p>
      )}
      <button onClick={() => (setSubmitted(false), setRevealed(0))} className="mt-3 text-[13px] font-semibold text-[var(--color-link)] hover:underline">
        Change my picks
      </button>
    </section>
  );
}
