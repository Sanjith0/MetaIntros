"use client";

import { useEffect, useRef, useState } from "react";

interface Stats {
  guests: number;
  queued: number;
  parties: number;
  locked: number;
  met: number;
  partiesMet: number;
}

const ZERO: Stats = { guests: 0, queued: 0, parties: 0, locked: 0, met: 0, partiesMet: 0 };

/** One big number that pulses when it changes. */
function Counter({ label, value, sub, testId, wide = false }: { label: string; value: number; sub?: string; testId: string; wide?: boolean }) {
  const prev = useRef(value);
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    if (value !== prev.current) {
      prev.current = value;
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 500);
      return () => clearTimeout(t);
    }
  }, [value]);
  return (
    <div className={`rounded-[14px] bg-white p-4 shadow-[var(--shadow-card)] ${wide ? "md:col-span-2" : ""}`}>
      <div className="text-[13px] font-semibold uppercase tracking-wide text-[var(--color-ink-2)]">{label}</div>
      <div className={`text-[56px] font-extrabold leading-none tabular-nums transition-colors ${pulse ? "text-[var(--color-pq)]" : "text-[var(--color-ink)]"}`} data-testid={testId}>
        {value}
      </div>
      {sub && <div className="mt-1 text-[13px] text-[var(--color-ink-2)]">{sub}</div>}
    </div>
  );
}

/** The fair host's screen: live counts only, never names. */
export function FairHost({ qrSvg, joinUrl }: { qrSvg: string; joinUrl: string }) {
  const [s, setS] = useState<Stats>(ZERO);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const r = await fetch("/api/fair/stats", { cache: "no-store" });
        if (!stop && r.ok) setS((await r.json()) as Stats);
      } catch {}
    };
    void tick();
    const t = setInterval(tick, 1000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, []);

  const simulate = async (body: object) => {
    setBusy(true);
    const r = await fetch("/api/fair/simulate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (r.ok) setS((await r.json()) as Stats);
    setBusy(false);
  };

  const inParties = s.parties * 5;
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Counter label="Guests joined" value={s.guests} sub="scanned the code and said yes" testId="fair-guests" />
          <Counter label="In the queue" value={s.queued} sub="waiting for their five" testId="fair-queued" />
          <Counter label="Parties formed" value={s.parties} sub={`${inParties} people`} testId="fair-parties" />
          <Counter label="Plans locked" value={s.locked} sub="all five agreed, or code picked" testId="fair-locked" />
          <Counter label="Met at the door" value={s.met} sub={`${s.partiesMet} ${s.partiesMet === 1 ? "party" : "parties"} together`} testId="fair-met" wide />
        </div>
        {/* Funnel */}
        <div className="rounded-[14px] bg-white p-4 shadow-[var(--shadow-card)]" data-testid="fair-funnel">
          <div className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-[var(--color-ink-2)]">Tonight so far</div>
          {[
            ["Joined", s.guests],
            ["In a party", Math.min(inParties, s.guests)],
            ["Plan locked", Math.min(s.locked * 5, s.guests)],
            ["Met", s.met],
          ].map(([label, n]) => (
            <div key={label as string} className="mb-1.5 flex items-center gap-3">
              <span className="w-[90px] text-[13px] font-semibold">{label}</span>
              <span className="h-5 flex-1 overflow-hidden rounded-full bg-[var(--color-wash)]">
                <span className="block h-full rounded-full bg-gradient-to-r from-[var(--color-pq)] to-[var(--color-pq-2)] transition-[width] duration-500" style={{ width: `${s.guests ? (Number(n) / s.guests) * 100 : 0}%` }} />
              </span>
              <span className="w-8 text-right font-mono text-[13px] tabular-nums">{n}</span>
            </div>
          ))}
          <div className="mt-2 text-[12px] text-[var(--color-ink-2)]">Counts only. The host never sees who is with whom, anyone's sentence, or anyone's picks.</div>
        </div>
      </div>
      <aside className="space-y-4">
        <div className="rounded-[14px] bg-white p-4 text-center shadow-[var(--shadow-card)]">
          <div className="text-[15px] font-bold">Scan to join</div>
          <div className="mx-auto mt-2 w-[220px] rounded-[10px] p-1 ring-1 ring-[var(--color-divider)]" dangerouslySetInnerHTML={{ __html: qrSvg }} />
          <div className="mt-1 break-all font-mono text-[11px] text-[var(--color-ink-2)]">{joinUrl}</div>
        </div>
        <div className="rounded-[14px] border border-dashed border-[var(--color-divider)] bg-white p-4">
          <div className="text-[13px] font-semibold">Demo only: fictional guests</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button disabled={busy} data-testid="sim-guests" onClick={() => simulate({ kind: "guests", n: 10 })} className="press rounded-[6px] bg-[var(--color-btn-2)] px-3 py-1.5 text-[13px] font-semibold disabled:opacity-50">
              10 guests join
            </button>
            <button disabled={busy} data-testid="sim-arrivals" onClick={() => simulate({ kind: "arrivals" })} className="press rounded-[6px] bg-[var(--color-btn-2)] px-3 py-1.5 text-[13px] font-semibold disabled:opacity-50">
              Locked parties arrive
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
