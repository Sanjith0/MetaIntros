"use client";

import { useState } from "react";
import { IconCheck } from "@/components/icons";
import type { Check } from "@/lib/server/preflight";

const MARK: Record<Check["status"], { sign: string; cls: string; sr: string }> = {
  ok: { sign: "", cls: "bg-[var(--color-on-bg)] text-[var(--color-on-ink)]", sr: "OK" },
  warn: { sign: "!", cls: "bg-[#fff4d6] text-[#7a4b00]", sr: "Note" },
  fail: { sign: "×", cls: "bg-[#fdecef] text-[#a8132d]", sr: "Problem" },
};

/** Preflight: one button before you go on stage. Changes nothing. */
export function Preflight() {
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ ready: boolean; checks: Check[] } | null>(null);
  const run = async () => {
    setBusy(true);
    const r = await fetch("/api/demo/preflight", { method: "POST" });
    setRes(r.ok ? ((await r.json()) as { ready: boolean; checks: Check[] }) : null);
    setBusy(false);
  };
  const notes = res?.checks.filter((c) => c.status === "warn").length ?? 0;
  return (
    <section className="mb-4 rounded-[12px] bg-white p-4 shadow-[var(--shadow-card)]" data-testid="preflight">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-bold">Preflight</h2>
          <p className="text-[13px] text-[var(--color-ink-2)]">Rehearses the whole demo party in a sandbox and checks what you need. Changes nothing.</p>
        </div>
        <button onClick={run} disabled={busy} data-testid="preflight-run" className="press rounded-[6px] bg-[var(--color-pq)] px-3 py-2 text-[14px] font-semibold text-white disabled:opacity-60">
          {busy ? "Checking…" : res ? "Run again" : "Run preflight"}
        </button>
      </div>
      {res && (
        <>
          <div className={`mt-3 rounded-[8px] px-3 py-2 text-[15px] font-bold ${res.ready ? "bg-[var(--color-on-bg)] text-[var(--color-on-ink)]" : "bg-[#fdecef] text-[#a8132d]"}`} data-testid="preflight-verdict" data-ready={res.ready}>
            {res.ready ? (notes ? `Ready, with ${notes} ${notes === 1 ? "note" : "notes"}` : "Ready for the demo") : "Not ready: fix what's marked ×"}
          </div>
          <ul className="mt-2 divide-y divide-[var(--color-divider)]">
            {res.checks.map((c) => (
              <li key={c.id} className="flex gap-3 py-2" data-testid={`preflight-${c.id}`} data-status={c.status}>
                <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[14px] font-bold ${MARK[c.status].cls}`}>
                  {c.status === "ok" ? <IconCheck size={14} /> : MARK[c.status].sign}
                  <span className="sr-only">{MARK[c.status].sr}</span>
                </span>
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold">{c.label}</div>
                  <div className="text-[13px] text-[var(--color-ink-2)]">{c.detail}</div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
