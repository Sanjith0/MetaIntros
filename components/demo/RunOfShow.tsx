"use client";

import { useEffect, useState } from "react";
import { BEATS, beatAt, DEMO_SECONDS, mmss, type Beat } from "@/lib/demo/script";

/** The five-minute run of show: a clock, the beat you're on, what to say, and one-click setup. */
export function RunOfShow() {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (startedAt === null || pausedAt !== null) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [startedAt, pausedAt]);
  const elapsed = startedAt === null ? 0 : ((pausedAt ?? now) - startedAt) / 1000;
  const current = beatAt(elapsed);
  const over = elapsed - DEMO_SECONDS;

  const start = () => {
    if (startedAt === null) {
      setStartedAt(Date.now());
      setNow(Date.now());
    } else if (pausedAt !== null) {
      setStartedAt(startedAt + (Date.now() - pausedAt));
      setPausedAt(null);
      setNow(Date.now());
    } else setPausedAt(Date.now());
  };
  const reset = () => {
    setStartedAt(null);
    setPausedAt(null);
  };
  const run = async (b: Beat, label: string) => {
    const a = b.actions.find((x) => x.label === label)!;
    for (const c of a.calls) {
      const r = await fetch(c.url, { method: c.method ?? "POST", headers: { "content-type": "application/json" }, body: c.body === undefined ? undefined : JSON.stringify(c.body) });
      if (!r.ok) {
        setMsg(`${label}: ${r.status}`);
        return;
      }
    }
    setMsg(`${label}: done`);
  };

  return (
    <section className="mb-4 rounded-[12px] bg-white p-4 shadow-[var(--shadow-card)]" data-testid="run-of-show">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[220px] flex-1">
          <h2 className="text-[17px] font-bold">Run of show</h2>
          <p className="text-[13px] text-[var(--color-ink-2)]">Nine beats to 5:00. Start the clock when you start talking.</p>
        </div>
        <div className={`font-mono text-[28px] font-bold tabular-nums ${over > 0 ? "text-[#a8132d]" : ""}`} data-testid="ros-clock" aria-live="off">
          {mmss(elapsed)}
          <span className="text-[15px] font-semibold text-[var(--color-ink-2)]"> / 5:00</span>
        </div>
        <button onClick={start} data-testid="ros-start" className="press rounded-[6px] bg-[var(--color-pq)] px-3 py-2 text-[14px] font-semibold text-white">
          {startedAt === null ? "Start the clock" : pausedAt !== null ? "Resume" : "Pause"}
        </button>
        <button onClick={reset} className="press rounded-[6px] bg-[var(--color-btn-2)] px-3 py-2 text-[14px] font-semibold">
          Reset clock
        </button>
      </div>
      {over > 0 && (
        <div className="mt-2 rounded-[6px] bg-[#fdecef] px-3 py-1.5 text-[13px] font-semibold text-[#a8132d]" role="status">
          Over time by {mmss(over)}: go to “Check us”.
        </div>
      )}
      <ol className="mt-3 grid gap-2 md:grid-cols-3">
        {BEATS.map((b) => {
          const isNow = startedAt !== null && b.id === current.id;
          const done = startedAt !== null && elapsed >= b.end;
          return (
            <li
              key={b.id}
              data-testid={`beat-${b.id}`}
              data-now={isNow}
              aria-current={isNow ? "step" : undefined}
              className={`rounded-[10px] p-3 ring-1 ${isNow ? "bg-[var(--color-pq-soft)] ring-[var(--color-pq)]" : done ? "bg-[var(--color-wash)] ring-transparent" : "bg-white ring-[var(--color-divider)]"}`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[15px] font-bold">
                  {b.title}
                  {done && <span className="ml-1.5 text-[12px] font-semibold text-[var(--color-ink-2)]">Done</span>}
                </span>
                <span className="font-mono text-[12px] text-[var(--color-ink-2)]">
                  {mmss(b.at)}–{mmss(b.end)}
                </span>
              </div>
              <p className="mt-1 text-[13px]">“{b.say}”</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {b.show.map((s) => (
                  <a key={s.href} href={s.href} target="_blank" rel="noreferrer" className="rounded-[6px] bg-[var(--color-btn-2)] px-2 py-1 text-[12px] font-semibold">
                    Open {s.label} ↗
                  </a>
                ))}
                {b.actions.map((a) => (
                  <button key={a.label} onClick={() => run(b, a.label)} className="press rounded-[6px] bg-[var(--color-pq)] px-2 py-1 text-[12px] font-semibold text-white">
                    {a.label}
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ol>
      {msg && (
        <div className="mt-2 text-[13px] font-semibold text-[var(--color-ink-3)]" data-testid="ros-msg" role="status">
          {msg}
        </div>
      )}
    </section>
  );
}
