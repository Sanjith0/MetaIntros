"use client";

import { useEffect, useRef, useState } from "react";
import { Brain, CheckCircle2, ChevronDown, ShieldCheck, Sparkles, Wrench } from "lucide-react";
import { useLiveEvents } from "@/components/useLiveEvents";

interface Step {
  id: string;
  agent: string;
  kind: "tool_call" | "reasoning" | "decision" | "safety_check";
  toolName: string | null;
  summary: string;
  stepIndex: number;
}

const AGENT_LABEL: Record<string, string> = {
  party_formation: "Party Formation Agent",
  event_selection: "Event Selection Agent",
  host: "AI Host",
  talk_cards: "Talk Cards Agent",
  companion: "Companion Agents",
};

const ICON = { tool_call: Wrench, reasoning: Brain, decision: CheckCircle2, safety_check: ShieldCheck };

/** "How we matched you": agent steps stream in one by one (and live via SSE as they're written). */
export function MatchTracePanel({ partyId, dark = false, defaultOpen = true }: { partyId: string; dark?: boolean; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [steps, setSteps] = useState<Step[]>([]);
  const [shown, setShown] = useState(0);
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    fetch(`/api/party/${partyId}/trace`)
      .then((r) => (r.ok ? r.json() : []))
      .then((s: Step[]) => setSteps(s))
      .catch(() => {});
  }, [partyId]);

  useLiveEvents(["trace"], (_t, data) => {
    const d = data as { partyId: string; step: Step };
    if (d?.partyId === partyId) setSteps((s) => (s.some((x) => x.id === d.step.id) ? s : [...s, d.step].sort((a, b) => a.stepIndex - b.stepIndex)));
  });

  // reveal one step at a time
  useEffect(() => {
    if (!open || shown >= steps.length) return;
    const t = setTimeout(() => setShown((n) => n + 1), shown === 0 ? 250 : 550);
    return () => clearTimeout(t);
  }, [open, shown, steps.length]);

  const tone = dark
    ? { box: "bg-black/25 border-white/15 text-white", sub: "text-[#c4b5fd]", item: "bg-white/5" }
    : { box: "bg-white border-[#e4e6eb] text-fb-text", sub: "text-fb-muted", item: "bg-fb-bg" };

  return (
    <section data-testid="trace-panel" className={`mt-5 rounded-2xl border ${tone.box}`}>
      <button type="button" onClick={() => setOpen((o) => !o)} data-testid="trace-toggle" aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3 font-bold">
        <span className="flex items-center gap-2"><Sparkles size={18} className="text-[#a855f7]" /> How we matched you</span>
        <ChevronDown size={18} className={`transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ol className="space-y-1.5 px-3 pb-3" data-testid="trace-steps">
          {steps.slice(0, shown).map((s) => {
            const Icon = ICON[s.kind] ?? Wrench;
            return (
              <li key={s.id} data-testid="trace-step" data-kind={s.kind} className={`flex gap-2 rounded-xl p-2 text-sm animate-[qu-pop_.35s_ease-out] ${tone.item}`}>
                <Icon size={16} className={`mt-0.5 shrink-0 ${s.kind === "safety_check" ? "text-emerald-400" : s.kind === "decision" ? "text-[#60a5fa]" : "text-[#a855f7]"}`} />
                <span className="min-w-0">
                  <span className={`block text-[10px] font-semibold uppercase tracking-wider ${tone.sub}`}>
                    {AGENT_LABEL[s.agent] ?? s.agent}
                    {s.toolName && <span className="ml-1 font-mono normal-case">· {s.toolName}()</span>}
                  </span>
                  <span className="block leading-snug">{s.summary}</span>
                </span>
              </li>
            );
          })}
          {shown < steps.length && <li className={`px-2 text-xs ${tone.sub} animate-pulse`}>thinking…</li>}
        </ol>
      )}
    </section>
  );
}
