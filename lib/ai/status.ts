/**
 * Honest AI labels. Pure (no node imports) so client components can use the same wording.
 *
 * Rules: we only say "live" when the app is actually set to call Muse with a key and recent
 * calls aren't failing; replayed (cached) Muse output is labeled "replay"; anything produced
 * by templates or code is labeled as such, never as Muse.
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
  /** live Muse calls in flight */
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

  if (i.mode === "mock") return { ...base, state: "mock", label: "Mock AI", detail: "Test mode: a scripted mock stands in for Muse. No real model calls." };

  if (i.mode === "cache") {
    if (window.length > 0 && recent.cache === 0 && recent.fallback > 0)
      return { ...base, state: "offline", label: "Templates", detail: `Offline mode and nothing matched the saved Muse outputs, so agents used deterministic templates. ${tally}` };
    return {
      ...base,
      state: "replay",
      label: "Muse replay",
      detail: `Offline mode: agents replay outputs ${i.model} produced earlier (saved cache), no live calls.${recent.fallback ? " Cache misses used templates." : ""}${window.length ? ` ${tally}` : ""}`,
    };
  }

  // live mode
  if (!i.hasKey) return { ...base, state: "offline", label: "Muse offline", detail: "Live mode is on but no MODEL_API_KEY is set: saved replays and templates only." };
  if (recentFail)
    return { ...base, state: "degraded", label: "Muse ⚠ fallback", detail: `Recent Muse calls failed (${recentFail.error ?? "unknown error"}); those agents used templates. ${tally}` };
  return {
    ...base,
    state: "live",
    label: "Muse live",
    detail: `Live: agents call ${i.model} on anything not already in the saved cache.${window.length ? ` ${tally}` : ""}`,
  };
}

/** Collapse several call sources (e.g. one per pre-chat) into one honest label. */
export function combineSources(sources: AgentSource[]): AgentSource {
  const uniq = [...new Set(sources)];
  if (uniq.length === 0) return "code";
  if (uniq.length === 1) return uniq[0];
  const muse = uniq.filter((x) => x === "live" || x === "cache");
  // never round up: live + replay is labeled replay, anything without Muse is not called Muse
  if (muse.length === uniq.length) return "cache";
  if (muse.length) return "mixed";
  if (uniq.includes("mock")) return "mock";
  return "template";
}

export interface SourceLabel {
  label: string;
  /** visual tone; "muse" tones only for output a Muse model actually wrote */
  tone: "live" | "replay" | "mock" | "template" | "mixed";
  detail: string;
  /** true when a Muse model produced this output (now or earlier) */
  muse: boolean;
}

export function describeSource(source: string | null | undefined): SourceLabel | null {
  switch (source) {
    case "live":
      return { label: "Muse · live", tone: "live", muse: true, detail: "Written by a live Muse call just now." };
    case "cache":
      return { label: "Muse · replay", tone: "replay", muse: true, detail: "Muse wrote this earlier; replayed from the saved cache (offline demo mode)." };
    case "mock":
      return { label: "Mock AI", tone: "mock", muse: false, detail: "Scripted mock (test mode), not a real model." };
    case "fallback":
    case "template":
      return { label: "Template", tone: "template", muse: false, detail: "No model output was available or it failed a check, so a deterministic template was used." };
    case "code":
      return { label: "Rules", tone: "template", muse: false, detail: "A deterministic check in code (scoring, safety rules), not a model." };
    case "mixed":
      return { label: "Muse · mixed", tone: "mixed", muse: true, detail: "Part of this came from Muse (live or replayed) and part from templates or code." };
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
