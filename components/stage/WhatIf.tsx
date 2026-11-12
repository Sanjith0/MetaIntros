"use client";

import { useEffect, useRef, useState } from "react";
import { removedLabel, type WhatIfMember, type WhatIfOutcome, type WhatIfResult } from "@/lib/stage/whatif";

const key = (ownerId: string, ruleId: string) => `${ownerId}|${ruleId}`;

function Outcome({ title, o, opened, testid }: { title: string; o: WhatIfOutcome; opened: string[]; testid: string }) {
  return (
    <div className="rounded-[8px] bg-black/30 p-3" data-testid={testid}>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-white/60">{title}</div>
      <div className="mt-1 text-[16px] font-bold text-white" data-testid={`${testid}-locked`}>
        🔒 {o.locked ?? "Nothing locks"}
        <span className="ml-2 text-[12px] font-normal text-white/60">{o.lockedBy === "fallback" ? "best valid plan (code)" : o.lockedBy === "signatures" ? "five signatures" : ""}</span>
      </div>
      <ul className="mt-2 space-y-1 text-[13px]">
        {o.unavailable.length === 0 && <li className="text-white/60">No plan unavailable</li>}
        {o.unavailable.map((t) => (
          <li key={t} className="text-red-200 line-through decoration-red-400/70">
            {t} · unavailable
          </li>
        ))}
        {opened.map((t) => (
          <li key={t} className="font-semibold text-emerald-200" data-testid="whatif-opened">
            {t} · opens up
          </li>
        ))}
      </ul>
    </div>
  );
}

/** "What if" on the projector: drop some rules, re-run the table in a sandbox, compare with tonight. */
export function WhatIf({ partyId, locked }: { partyId: string | null; locked: boolean }) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<WhatIfMember[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<WhatIfResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const show = async () => {
    setOpen(true);
    setResult(null);
    setError(null);
    const r = await fetch(`/api/stage/whatif?party=${partyId}`, { cache: "no-store" });
    const ms = r.ok ? ((await r.json()) as { members: WhatIfMember[] }).members : [];
    setMembers(ms);
    const maya = ms.find((m) => m.id === "maya")?.rules.find((x) => x.label === "No drink minimum");
    setPicked(new Set(maya ? [key("maya", maya.id)] : []));
  };
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const toggle = (k: string) => {
    setResult(null);
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  };
  const run = async () => {
    setBusy(true);
    setError(null);
    const remove = [...picked].map((k) => {
      const [ownerId, ruleId] = k.split("|");
      return { ownerId, ruleId };
    });
    const r = await fetch("/api/stage/whatif", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ partyId, remove }) });
    const j = (await r.json()) as WhatIfResult | { ok: false; error: string };
    setBusy(false);
    if (j.ok) setResult(j);
    else setError(j.error);
  };

  if (!partyId || !locked) return null;
  return (
    <>
      <button onClick={show} data-testid="whatif-open" className="rounded-[6px] bg-white/10 px-3 py-1.5 text-[13px] font-semibold text-white ring-1 ring-white/20 hover:bg-white/20">
        What if…
      </button>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/70 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="What if" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="w-full max-w-[820px] rounded-[14px] bg-[#14151c] ring-1 ring-white/15" data-testid="whatif">
            <div className="flex items-start gap-3 border-b border-white/10 p-4">
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-violet-300">What if</div>
                <div className="text-[18px] font-bold">Take rules away and run the same five again</div>
                <div className="mt-1 text-[13px] text-white/70">A sandbox: the same people, sentences and code checks, on the mock model. Nothing here touches tonight&apos;s party or any phone.</div>
              </div>
              <button ref={closeRef} onClick={() => setOpen(false)} className="rounded-[6px] bg-white/10 px-3 py-1.5 text-[13px] font-semibold hover:bg-white/20">
                Close
              </button>
            </div>
            <div className="space-y-3 p-4">
              <ul className="space-y-2">
                {members.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center gap-2">
                    <span className="w-14 shrink-0 text-[14px] font-semibold text-white/90">{m.name}</span>
                    {m.rules.length === 0 && <span className="text-[13px] text-white/50">no rules</span>}
                    {m.rules.map((r) => {
                      const on = picked.has(key(m.id, r.id));
                      return (
                        <button
                          key={r.id}
                          onClick={() => toggle(key(m.id, r.id))}
                          aria-pressed={on}
                          data-testid={`whatif-rule-${m.id}-${r.id}`}
                          title={`“${r.words}”`}
                          className={`rounded-full px-3 py-1 text-[13px] font-semibold ring-1 ${on ? "bg-violet-600 text-white ring-violet-400 line-through" : "bg-white/5 text-white/85 ring-white/15 hover:bg-white/10"}`}
                        >
                          {r.label}
                        </button>
                      );
                    })}
                  </li>
                ))}
              </ul>
              <button onClick={run} disabled={busy || picked.size === 0} data-testid="whatif-run" className="rounded-[6px] bg-violet-600 px-4 py-2 text-[14px] font-semibold hover:bg-violet-500 disabled:opacity-50">
                {busy ? "Running five agents in a sandbox…" : picked.size ? `Run it without ${picked.size === 1 ? "this rule" : `these ${picked.size} rules`}` : "Pick a rule to take away"}
              </button>
              {error && <div className="text-[14px] text-red-200">{error}</div>}
              {result && (
                <div data-testid="whatif-result" data-changed={result.changed} className="space-y-2">
                  <div className="text-[16px] font-bold">
                    {result.changed ? `Without ${removedLabel(result.removed)}, ${result.sandbox.locked ?? "nothing"} locks instead.` : `Without ${removedLabel(result.removed)}, ${result.live.locked} still locks.`}
                    {result.opened.length > 0 && <span className="font-normal text-white/75"> {result.opened.join(", ")} {result.opened.length === 1 ? "opens" : "open"} up.</span>}
                    {result.opened.length === 0 && <span className="font-normal text-white/75"> Every closed plan has another rule against it.</span>}
                  </div>
                  {!result.changed && result.opened.length > 0 && result.sandbox.lockedBy === "signatures" && (
                    <div className="text-[13px] text-white/70" data-testid="whatif-why">
                      Rules decide which plans are open; with more open, the five agents still signed {result.sandbox.locked}.
                    </div>
                  )}
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Outcome title="Tonight (live)" o={result.live} opened={[]} testid="whatif-live" />
                    <Outcome title="In the sandbox" o={result.sandbox} opened={result.opened} testid="whatif-sandbox" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
