"use client";

import { Sparkles } from "lucide-react";
import { describeSource, type AiState } from "@/lib/ai/status";
import { useAiStatus } from "./useAiStatus";

const STATE_CLS: Record<AiState, string> = {
  live: "bg-gradient-to-r from-[#1877f2] to-[#a855f7] text-white",
  degraded: "bg-red-100 text-red-700",
  replay: "bg-[#ede9fe] text-[#6d28d9]",
  offline: "bg-amber-100 text-amber-800",
  mock: "bg-amber-100 text-amber-800",
};

/** App-wide badge: what the Muse agents are actually running on right now. */
export function AiStatusBadge({ className = "" }: { className?: string }) {
  const s = useAiStatus();
  if (!s) return null;
  return (
    <span
      data-testid="ai-status"
      data-state={s.state}
      title={s.detail}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${STATE_CLS[s.state]} ${className}`}
    >
      <Sparkles size={11} className={s.pending > 0 ? "animate-spin" : ""} />
      {s.label}
      {s.pending > 0 && <span data-testid="ai-pending">· {s.pending}</span>}
    </span>
  );
}

const TONE_CLS = {
  light: {
    live: "bg-gradient-to-r from-[#1877f2] to-[#a855f7] text-white",
    replay: "bg-[#ede9fe] text-[#6d28d9]",
    mixed: "bg-[#ede9fe] text-[#6d28d9]",
    mock: "bg-amber-100 text-amber-800",
    template: "bg-[#e4e6eb] text-fb-muted",
  },
  dark: {
    live: "bg-gradient-to-r from-[#3b82f6] to-[#a855f7] text-white",
    replay: "bg-[#a855f7]/25 text-[#e9d5ff]",
    mixed: "bg-[#a855f7]/25 text-[#e9d5ff]",
    mock: "bg-amber-300/20 text-amber-100",
    template: "bg-white/10 text-white/70",
  },
};

/** Per-output badge: who wrote this specific thing (live Muse, replayed Muse, template, mock). */
export function AiSourceBadge({ source, dark = false, className = "" }: { source: string | null | undefined; dark?: boolean; className?: string }) {
  const d = describeSource(source);
  if (!d) return null;
  return (
    <span
      data-testid="ai-source"
      data-source={source}
      title={d.detail}
      className={`inline-flex items-center gap-0.5 whitespace-nowrap rounded-full px-1.5 py-px text-[9px] font-bold uppercase tracking-wide normal-case ${TONE_CLS[dark ? "dark" : "light"][d.tone]} ${className}`}
    >
      {d.muse && <Sparkles size={9} />}
      {d.label}
    </span>
  );
}
