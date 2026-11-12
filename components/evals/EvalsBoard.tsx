"use client";

import { useCallback, useEffect, useState } from "react";
import type { ArchResult, Comparison } from "@/lib/evals/compare";

type Row = { key: string; label: string; hint: string; value: (r: ArchResult, n: number) => string; bad?: (r: ArchResult) => boolean; good?: (r: ArchResult) => boolean };

const ROWS: Row[] = [
  { key: "leaking-lines", label: "Lines that reveal someone's private rule", hint: "Public text anyone in the party can read", value: (r) => (r.lines ? `${r.leakingLines} of ${r.lines}` : "no lines"), bad: (r) => r.leakingLines > 0, good: (r) => r.lines > 0 && r.leakingLines === 0 },
  { key: "leaks", label: "Private phrases seen by another member", hint: "One private phrase × one other member who can see it", value: (r) => String(r.leaks), bad: (r) => r.leaks > 0, good: (r) => r.leaks === 0 },
  { key: "exposure", label: "Others' rules in the writer's context", hint: "On average, when one member's public text is written", value: (r) => String(r.exposure), bad: (r) => r.exposure > 0, good: (r) => r.exposure === 0 },
  { key: "blocked", label: "Lines the verifier had to block", hint: "Blocked lines are replaced with a neutral phrase", value: (r) => (r.lines ? `${r.blocked} of ${r.lines}` : "–") },
  { key: "feasible", label: "Plan passes every member's rules", hint: "Checked by code after the fact", value: (r, n) => `${r.feasible} of ${n}`, good: (r) => r.feasible > 0 },
  { key: "agreed", label: "All five signed", hint: "Agreement reached at the table", value: (r, n) => (r.agreed === null ? "–" : `${r.agreed} of ${n}`) },
  { key: "pairs", label: "Shared lines and openers for pairs", hint: "Built only from approved facts", value: (r) => String(r.pairLines) },
];

/** The leak test four ways, side by side. */
export function EvalsBoard() {
  const [c, setC] = useState<Comparison | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async (fresh = false) => {
    setBusy(true);
    const r = await fetch(`/api/evals${fresh ? "?fresh=1" : ""}`, { cache: "no-store" });
    if (r.ok) setC((await r.json()) as Comparison);
    setBusy(false);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  if (!c)
    return (
      <div className="rounded-[12px] bg-white p-6 text-[var(--color-ink-2)] shadow-[var(--shadow-card)]" data-testid="evals-loading">
        Running the leak test on 25 generated parties…
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-[13px] text-[var(--color-ink-2)]">
        <span>
          {c.parties} generated parties · seed {c.seed} · {c.model === "mock" ? "mock model (no key set)" : "real model"}
        </span>
        <button onClick={() => load(true)} disabled={busy} data-testid="evals-rerun" className="press rounded-[6px] bg-[var(--color-btn-2)] px-3 py-1.5 text-[13px] font-semibold text-[var(--color-ink)] disabled:opacity-50">
          {busy ? "Running…" : "Run again"}
        </button>
      </div>
      <div className="overflow-x-auto rounded-[12px] bg-white shadow-[var(--shadow-card)]">
        <table className="w-full min-w-[720px] border-collapse text-left text-[14px]" data-testid="evals-table">
          <thead>
            <tr className="border-b border-[var(--color-divider)]">
              <th className="p-3 text-[13px] font-semibold text-[var(--color-ink-2)]">Measure</th>
              {c.results.map((r) => (
                <th key={r.id} className={`p-3 align-bottom ${r.id === "five-agents" ? "bg-[var(--color-pq-soft)]" : ""}`} data-testid={`evals-col-${r.id}`}>
                  <div className="text-[15px] font-bold">{r.label}</div>
                  {r.simulated && <div className="mt-0.5 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold uppercase text-amber-800">Simulated</div>}
                  {r.id === "five-agents" && <div className="mt-0.5 inline-block rounded bg-[var(--color-pq)] px-1.5 py-0.5 text-[11px] font-bold uppercase text-white">Party Queue</div>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.key} className="border-b border-[var(--color-divider)] last:border-b-0">
                <td className="p-3">
                  <div className="font-semibold">{row.label}</div>
                  <div className="text-[12px] text-[var(--color-ink-2)]">{row.hint}</div>
                </td>
                {c.results.map((r) => (
                  <td
                    key={r.id}
                    data-testid={`cell-${r.id}-${row.key}`}
                    className={`p-3 font-mono tabular-nums ${r.id === "five-agents" ? "bg-[var(--color-pq-soft)]" : ""} ${row.bad?.(r) ? "font-bold text-[var(--color-badge)]" : row.good?.(r) ? "font-semibold text-[var(--color-positive)]" : ""}`}
                  >
                    {row.value(r, c.parties)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
