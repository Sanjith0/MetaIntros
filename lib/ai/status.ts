/**
 * Honest AI labels. Pure (no node imports) so client components can use the same wording.
 *
 * Rules: we only say "live" when the app is actually set to call AI with a key and recent
 * calls aren't failing; replayed (cached) AI output is labeled "replay"; anything produced
 * by templates or code is labeled as such, never as AI.
 */
import type { AiMode, AiSource } from "./types";

/** Everything an agent step can report. "template"/"code" = no model involved; "mixed" = several sources. */
export type AgentSource = AiSource | "template" | "code" | "mixed";

export type AiState = "live" | "degraded" | "replay" | "offline" | "mock";

export interface AiStatus {
  state: AiState;
  label: string;
  detail: string;
  mode: AiMode;
  model: string;
  hasKey: boolean;
  /** live AI calls in flight */
  pending: number;
  /** counts by source over the recent window */
  recent: Record<AiSource, number>;
  lastError: string | null;
}

interface LogLike {
  source: AiSource;
  error?: string;
}

/** How many of the most recent calls decide the state. */
export const STATUS_WINDOW = 20;
/** A fallback this recent means the live path is not healthy right now. */
const DEGRADED_LOOKBACK = 5;

export function summarizeAi(i: { mode: AiMode; hasKey: boolean; model: string; log: LogLike[]; pending?: number }): AiStatus {
  const window = i.log.slice(-STATUS_WINDOW);
  const recent: Record<AiSource, number> = { live: 0, cache: 0, mock: 0, fallback: 0 };
  for (const e of window) recent[e.source]++;
  const lastFail = [...i.log].reverse().find((e) => e.source === "fallback");
  const recentFail = i.log.slice(-DEGRADED_LOOKBACK).find((e) => e.source === "fallback");
  const base = { mode: i.mode, model: i.model, hasKey: i.hasKey, pending: i.pending ?? 0, recent, lastError: lastFail?.error ?? null };
  const tally = `Last ${window.length} calls: ${recent.live} live, ${recent.cache} replayed, ${recent.fallback} template fallbacks.`;

  if (i.mode === "mock") return { ...base, state: "mock", label: "AI: test model", detail: "Test mode: a scripted test model stands in for AI. No real model calls." };

  if (i.mode === "cache") {
    if (window.length > 0 && recent.cache === 0 && recent.fallback > 0)
      return { ...base, state: "offline", label: "AI off: templates only", detail: `Offline mode and nothing matched the saved AI responses, so templates were used. ${tally}` };
    return {
      ...base,
      state: "replay",
      label: "AI: saved responses (offline)",
      detail: `Offline mode: saved responses ${i.model} wrote earlier are replayed, no live calls.${recent.fallback ? " Cache misses used templates." : ""}${window.length ? ` ${tally}` : ""}`,
    };
  }

  // live mode
  if (!i.hasKey) return { ...base, state: "offline", label: "AI off: no key", detail: "Live mode is on but no MODEL_API_KEY is set: saved responses and templates only." };
  if (recentFail)
    return { ...base, state: "degraded", label: "AI failing: using templates", detail: `Recent AI calls failed (${recentFail.error ?? "unknown error"}); those agents used templates. ${tally}` };
  return {
    ...base,
    state: "live",
    label: "AI: live",
    detail: `Live: agents call ${i.model} on anything not already in the saved cache.${window.length ? ` ${tally}` : ""}`,
  };
}

/** Collapse several call sources (e.g. one per pre-chat) into one honest label. */
export function combineSources(sources: AgentSource[]): AgentSource {
  const uniq = [...new Set(sources)];
  if (uniq.length === 0) return "code";
  if (uniq.length === 1) return uniq[0];
  const muse = uniq.filter((x) => x === "live" || x === "cache");
  // never round up: live + replay is labeled replay, anything without AI is not called AI
  if (muse.length === uniq.length) return "cache";
  if (muse.length) return "mixed";
  if (uniq.includes("mock")) return "mock";
  return "template";
}

export interface SourceLabel {
  label: string;
  detail: string;
  /** true when a model wrote this output (now, or earlier and saved) */
  ai: boolean;
}

export function describeSource(source: string | null | undefined): SourceLabel | null {
  switch (source) {
    case "live":
      return { label: "Written by AI just now", ai: true, detail: "Written by a live AI call just now." };
    case "cache":
      return { label: "Saved AI response", ai: true, detail: "AI wrote this earlier; replayed from saved responses (offline demo mode)." };
    case "mock":
      return { label: "Test model", ai: false, detail: "Scripted test model, not a real AI." };
    case "fallback":
      return { label: "Template (AI unavailable)", ai: false, detail: "No AI output was available or it failed a check, so a template was used." };
    case "template":
      return { label: "Template", ai: false, detail: "Written from a template; no AI was used." };
    case "code":
      return { label: "Checked by code", ai: false, detail: "A check in code (scoring, safety rules), not AI." };
    case "mixed":
      return { label: "Partly AI, partly template", ai: true, detail: "Part of this was written by AI (live or saved) and part from templates." };
    default:
      return null;
  }
}

/** Where an agent trace step's output came from: model steps record `output.source`; tool calls and safety checks are code. */
export function stepSource(s: { kind: string; output?: unknown }): string | null {
  const src = (s.output as { source?: unknown } | null | undefined)?.source;
  if (typeof src === "string") return src;
  return s.kind === "tool_call" || s.kind === "safety_check" ? "code" : null;
}
