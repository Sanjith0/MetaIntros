"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronRight, ListChecks, ShieldCheck, Sparkles, Wrench } from "lucide-react";
import { AiLabel, IconCircle, ListRow } from "@/components/fb";
import { Sheet } from "@/components/fb/Sheet";
import { useLiveEvents } from "@/components/useLiveEvents";
import { AiStatusNote } from "@/components/ai/AiSource";
import { describeSource } from "@/lib/ai/status";

interface Step {
  id: string;
  agent: string;
  kind: "tool_call" | "reasoning" | "decision" | "safety_check";
  summary: string;
  stepIndex: number;
  output?: { source?: string } | null;
}

const AGENT: Record<string, string> = {
  orchestrator: "Orchestrator",
  party_formation: "Squad matching",
  event_selection: "Event pick",
  hangout_planner: "Hangout plan",
  host: "AI host",
  talk_cards: "Talk cards",
  companion: "Companions",
  ratings: "Past ratings",
};


/**
 * "How we matched you", split honestly: what code checked, and what AI wrote (with its source).
 * No fake "thinking…" stagger: steps already exist when you open it; new ones stream in live.
 */
export function TraceList({ partyId }: { partyId: string }) {
  const [steps, setSteps] = useState<Step[] | null>(null);
  const load = useCallback(
    () =>
      fetch(`/api/party/${partyId}/trace`)
        .then((r) => (r.ok ? r.json() : []))
        .then((s: Step[]) => setSteps((prev) => (prev && prev.length > s.length ? prev : s)))
        .catch(() => setSteps((p) => p ?? [])),
    [partyId],
  );
  useEffect(() => {
    load();
  }, [load]);
  useLiveEvents(
    ["trace"],
    (_t, data) => {
      const d = data as { partyId: string; step: Step };
      if (d?.partyId !== partyId) return;
      setSteps((s) => ((s ?? []).some((x) => x.id === d.step.id) ? s : [...(s ?? []), d.step].sort((a, b) => a.stepIndex - b.stepIndex)));
    },
    load,
  );

  if (!steps) return <p className="px-4 py-6 text-center text-muted">Loading…</p>;
  // A step belongs to the AI group when an AI call produced it (it records its source): the
  // agents' picks, and also the host welcome, pre-chats and talk cards (decision steps).
  const isAi = (s: Step) => s.kind === "reasoning" || (s.kind === "decision" && typeof s.output?.source === "string" && s.output.source !== "code");
  const ai = steps.filter(isAi);
  const code = steps.filter((s) => !isAi(s));
  return (
    <div data-testid="trace-steps" className="pb-2">
      <h3 className="px-4 pt-1 text-body font-semibold">Written by AI</h3>
      <ul>
        {ai.map((s) => (
          <li key={s.id} data-testid="trace-step" data-kind={s.kind} className="flex gap-3 px-4 py-2">
            <IconCircle size={32}><Sparkles size={16} /></IconCircle>
            <span className="min-w-0">
              <span className="block text-meta text-muted">{AGENT[s.agent] ?? s.agent}</span>
              <span className="block text-body">{s.summary}</span>
              <AiLabel className="mt-0.5" testId="trace-source">{describeSource(s.output?.source)?.label ?? "Written by AI"}</AiLabel>
            </span>
          </li>
        ))}
        {ai.length === 0 && <li className="px-4 py-2 text-meta text-muted">No AI steps yet.</li>}
      </ul>
      <h3 className="mt-2 px-4 text-body font-semibold">Checked by code</h3>
      <ul>
        {code.map((s) => {
          const Icon = s.kind === "safety_check" ? ShieldCheck : s.kind === "decision" ? ListChecks : Wrench;
          return (
            <li key={s.id} data-testid="trace-step" data-kind={s.kind} className="flex gap-3 px-4 py-2">
              <IconCircle size={32}><Icon size={16} /></IconCircle>
              <span className="min-w-0">
                <span className="block text-meta text-muted">{AGENT[s.agent] ?? s.agent}</span>
                <span className="block text-body">{s.summary}</span>
              </span>
            </li>
          );
        })}
      </ul>
      <p className="px-4 pt-2 text-meta text-muted">
        Code builds and safety-checks every option. AI chooses among options that already passed and explains the choice, then code checks the choice again.
      </p>
      <p className="px-4 pt-1" data-testid="trace-ai-status">
        <AiStatusNote />
      </p>
    </div>
  );
}

/** One row that opens the trace in a sheet (the "Why am I seeing this?" pattern). */
export function TraceRow({ partyId }: { partyId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div data-testid="trace-panel">
      <ListRow
        onClick={() => setOpen(true)}
        testId="trace-toggle"
        leading={<IconCircle><ListChecks size={18} /></IconCircle>}
        title="How we matched you"
        subtitle="What code checked and what AI wrote"
        trailing={<ChevronRight size={20} className="text-muted" aria-hidden />}
      />
      <Sheet open={open} onClose={() => setOpen(false)} title="How we matched you" testId="trace-sheet">
        <TraceList partyId={partyId} />
      </Sheet>
    </div>
  );
}
