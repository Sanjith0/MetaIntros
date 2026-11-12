"use client";

import { AiLabel } from "@/components/fb";
import { describeSource } from "@/lib/ai/status";
import { useAiStatus } from "./useAiStatus";

/**
 * Where one piece of output came from, in plain words (DESIGN.md §1.8: AI is labeled, not themed).
 * Renders nothing for an unknown source, so old rows without one keep their existing label.
 */
export function AiSourceLabel({ source, className }: { source: string | null | undefined; className?: string }) {
  const d = describeSource(source);
  if (!d) return null;
  return (
    <span title={d.detail} data-testid="ai-source" data-source={source} className="inline-flex">
      <AiLabel className={className}>{d.label}</AiLabel>
    </span>
  );
}

/**
 * What the AI is running on right now (live, saved responses, templates, test model), from real
 * call results. SYNTHESIS #16: shown on /demo and as a footnote under "How we matched you" only.
 */
export function AiStatusNote({ className }: { className?: string }) {
  const s = useAiStatus();
  if (!s) return null;
  return (
    <span title={s.detail} data-testid="ai-status" data-state={s.state} className="inline-flex">
      <AiLabel className={className}>{s.label}</AiLabel>
    </span>
  );
}
