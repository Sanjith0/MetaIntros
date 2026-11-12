"use client";

import { useState } from "react";
import type { ScaleResult } from "@/lib/evals/scale";

const SIZES = [50, 100, 200] as const;

/** "At fair scale": a whole fair through the real loop, in a sandbox. */
export function ScaleBoard() {
  const [n, setN] = useState<(typeof SIZES)[number]>(100);
  const [busy, setBusy] = useState(false);
  const [r, setR] = useState<ScaleResult | null>(null);
  const run = async () => {
    setBusy(true);
    const res = await fetch(`/api/evals/scale?n=${n}`, { method: "POST" });
    setR(res.ok ? ((await res.json()) as ScaleResult) : null);
    setBusy(false);
  };
  const zero = (x: number) => (x === 0 ? "text-[var(--color-on-ink)]" : "text-[#a8132d]");
  const rows: [string, string, string?][] = r
    ? [
        ["Guests who scanned in and queued", `${r.guests}`],
        ["Parties formed", `${r.parties} (${r.locked} locked${r.noMatch ? `, ${r.noMatch} no match` : ""}${r.waiting ? `, ${r.waiting} still waiting` : ""})`],
        ["Join and form, all of them", `${r.formMs} ms`],
        ["Every table talk, all at once, to its lock", `${r.talkMs} ms · ${r.agentTurns} agent turns`],
        ["Lock to MATCH FOUND (server time)", `p50 ${r.matchLagMs.p50} ms · p95 ${r.matchLagMs.p95} ms · max ${r.matchLagMs.max} ms`],
        ["Locked plans that break someone's rule", `${r.invalidPlans}`, zero(r.invalidPlans)],
        [`Private words another member can load (${r.scanned} members scanned)`, `${r.leaks}`, zero(r.leaks)],
        ["Prompts that held someone else's words", `${r.promptLeaks}`, zero(r.promptLeaks)],
        ["Real model calls", `${r.realCalls}`],
      ]
    : [];
  return (
    <section className="mt-4 rounded-[12px] bg-white p-4 shadow-[var(--shadow-card)]" data-testid="scale">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-bold">At fair scale</h2>
          <p className="text-[13px] text-[var(--color-ink-2)]">
            Fictional guests scan in and queue; code forms parties; every party&apos;s five agents talk at once; code locks. The real loop, in a sandbox on the mock model: nothing live
            changes. A real model adds its own latency per round.
          </p>
        </div>
        <div className="flex items-center gap-1" role="group" aria-label="Guests">
          {SIZES.map((x) => (
            <button
              key={x}
              onClick={() => setN(x)}
              aria-pressed={n === x}
              className={`press rounded-[6px] px-2.5 py-1.5 text-[13px] font-semibold ${n === x ? "bg-[var(--color-on-bg)] text-[var(--color-on-ink)] ring-1 ring-[var(--color-on-ink)]/40" : "bg-[var(--color-btn-2)]"}`}
            >
              {x}
            </button>
          ))}
        </div>
        <button onClick={run} disabled={busy} data-testid="scale-run" className="press rounded-[6px] bg-[var(--color-pq)] px-3 py-2 text-[14px] font-semibold text-white disabled:opacity-60">
          {busy ? "Running…" : `Run ${n} guests`}
        </button>
      </div>
      {r && (
        <table className="mt-3 w-full text-[14px]" data-testid="scale-result">
          <tbody>
            {rows.map(([k, v, cls]) => (
              <tr key={k} className="border-t border-[var(--color-divider)]">
                <th scope="row" className="py-1.5 pr-3 text-left font-normal text-[var(--color-ink-2)]">
                  {k}
                </th>
                <td className={`py-1.5 text-right font-semibold tabular-nums ${cls ?? ""}`}>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
