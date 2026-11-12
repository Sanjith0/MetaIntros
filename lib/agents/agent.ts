import { z } from "zod";
import type { Brief, CandidatePlan } from "@/contracts";
import { callModel, type ModelSource } from "@/model/client";
import { ownerChecks } from "./judge";
import { NEUTRAL_PHRASES, type NeutralId, type PublicLine } from "./verifier";
import { auditContext, keepPrompt, type ContextAudit } from "./audit";
import { flag } from "@/lib/flags";

/* --------------------------------- types --------------------------------- */

export const PublicLineOut = z.object({ text: z.string().max(240), sourceIds: z.array(z.string()).max(3) });

export const Round1Out = z.object({
  verdicts: z
    .array(
      z.object({
        planId: z.string(),
        decision: z.enum(["accept", "reject"]),
        privateReason: z.string().max(240),
        preference: z.number().int().min(1).max(5),
      }),
    )
    .max(12),
  publicLine: PublicLineOut,
});
export type Round1Out = z.infer<typeof Round1Out>;

export const LaterOut = z.object({
  decision: z.enum(["concede", "hold", "sign"]),
  planId: z.string(),
  privateReason: z.string().max(240),
  publicLine: PublicLineOut,
});
export type LaterOut = z.infer<typeof LaterOut>;

/** What the table looks like to any member: public lines and marks only. */
export interface PublicTableRow {
  round: number;
  from: string; // first name, or "Table"
  text: string;
}

export interface TurnContext {
  partyId: string;
  ownerName: string;
  brief: Brief;
  plans: CandidatePlan[];
  table: PublicTableRow[];
  round: number;
  unavailable: string[];
  leadingPlanId: string | null;
  /** This owner's own round-1 preferences, so later rounds stay consistent. */
  ownPrefs?: Record<string, number>;
}

export interface TurnResult<T> {
  out: T;
  source: ModelSource;
  ms: number;
  note?: string;
  /** What was in this agent's prompt, checked by code before the call. */
  context?: ContextAudit;
}

/* ------------------------------- scoring ------------------------------- */

/** 1-5: how much this owner would like a plan. Private to the owner. */
export function preferenceFor(brief: Brief, plan: CandidatePlan): number {
  let score = 3;
  for (const p of brief.preferences) {
    if (p.tag === "open") score += 1;
    else if (plan.tags.includes(p.tag)) score += p.weight;
    if (p.tag === "quiet" && plan.tags.includes("loud")) score -= 2;
  }
  return Math.max(1, Math.min(5, score));
}

const matchedTags = (brief: Brief, plan: CandidatePlan) => brief.preferences.map((p) => p.tag).filter((t) => plan.tags.includes(t));

function firstApprovedPrefLine(brief: Brief): string | null {
  const prefLine = brief.shareable.find((l) => l.approved && l.factIds.some((f) => f.startsWith("bf-")));
  return prefLine?.id ?? brief.shareable.find((l) => l.approved)?.id ?? null;
}

function lineFrom(ids: string[], brief: Brief): PublicLine {
  const text = ids
    .map((id) => (id in NEUTRAL_PHRASES ? NEUTRAL_PHRASES[id as NeutralId] : brief.shareable.find((l) => l.id === id)?.text ?? ""))
    .join(" ");
  return { text, sourceIds: ids };
}

/* ---------------------------- the mock agent ---------------------------- */

/** Deterministic agent used with MOCK_MODEL=1 and as the fallback. */
export function mockRound1(ctx: TurnContext): Round1Out {
  const verdicts = ctx.plans.map((plan) => {
    const failing = ownerChecks(ctx.partyId, plan, ctx.brief).filter((c) => !c.pass);
    if (failing.length) {
      const words = failing
        .map((c) => {
          const rule = ctx.brief.hardRules.find((r) => r.id === c.ruleId);
          return `${c.detail} You said "${rule?.sourceText ?? ""}".`;
        })
        .join(" ");
      return { planId: plan.id, decision: "reject" as const, privateReason: words.slice(0, 240), preference: 1 };
    }
    const pref = preferenceFor(ctx.brief, plan);
    const tags = matchedTags(ctx.brief, plan);
    return {
      planId: plan.id,
      decision: "accept" as const,
      privateReason: (tags.length ? `Fits your rules and matches: ${tags.join(", ")}.` : "Fits your rules.").slice(0, 240),
      preference: pref,
    };
  });
  const lineId = firstApprovedPrefLine(ctx.brief);
  return { verdicts, publicLine: lineFrom(lineId ? [lineId] : ["neutral-hello"], ctx.brief) };
}

export function mockLater(ctx: TurnContext): LaterOut {
  const lead = ctx.plans.find((p) => p.id === ctx.leadingPlanId);
  const prefs = ctx.ownPrefs ?? Object.fromEntries(ctx.plans.map((p) => [p.id, preferenceFor(ctx.brief, p)]));
  const available = ctx.plans.filter((p) => !ctx.unavailable.includes(p.id));
  const top = [...available].sort((a, b) => (prefs[b.id] ?? 0) - (prefs[a.id] ?? 0))[0];
  if (!lead || !top) {
    return { decision: "hold", planId: top?.id ?? ctx.plans[0]!.id, privateReason: "No leading plan yet.", publicLine: lineFrom(["neutral-thinking"], ctx.brief) };
  }
  const gap = (prefs[top.id] ?? 0) - (prefs[lead.id] ?? 0);
  if (gap >= 2 && ctx.round === 2) {
    return {
      decision: "hold",
      planId: top.id,
      privateReason: `You'd rather do ${top.title} (${prefs[top.id]}/5) than ${lead.title} (${prefs[lead.id]}/5). Holding one round.`,
      publicLine: lineFrom(["neutral-thinking"], ctx.brief),
    };
  }
  if (gap >= 2) {
    return {
      decision: "concede",
      planId: lead.id,
      privateReason: `${lead.title} isn't your first pick, but it fits all your rules and the group wants it.`,
      publicLine: lineFrom(["neutral-group"], ctx.brief),
    };
  }
  return {
    decision: "sign",
    planId: lead.id,
    privateReason: `${lead.title} fits your rules and you rated it ${prefs[lead.id]}/5.`,
    publicLine: lineFrom(["neutral-in"], ctx.brief),
  };
}

/* ------------------------------ the prompt ------------------------------ */

const SYSTEM = `You are one person's agent at a shared table where five strangers settle one plan for tonight.
You see only your own person's private brief and the public table. Never reveal your person's rules or reasons.
Your public line must be copied exactly from your approved lines or the neutral phrases, by id. Use one, at most two.
Return only JSON.`;

function promptFor(ctx: TurnContext): string {
  const b = ctx.brief;
  const view = {
    you_represent: ctx.ownerName,
    round: ctx.round,
    your_private_rules: b.hardRules.map((r) => ({ kind: r.kind, value: r.value, their_words: r.sourceText })),
    your_preferences: b.preferences.map((p) => ({ tag: p.tag, weight: p.weight })),
    your_approved_lines: b.shareable.filter((l) => l.approved).map((l) => ({ id: l.id, text: l.text })),
    neutral_phrases: Object.entries(NEUTRAL_PHRASES).map(([id, text]) => ({ id, text })),
    plans: ctx.plans.map((p) => ({
      id: p.id,
      title: p.title,
      venue: p.venueName,
      venue_kind: p.venueKind,
      start: p.start,
      end: p.end,
      price_usd: p.priceUsd,
      drink_minimum: p.drinkMinimum,
      tags: p.tags,
      about: p.blurb,
      unavailable: ctx.unavailable.includes(p.id),
    })),
    public_table: ctx.table,
    leading_plan_id: ctx.leadingPlanId,
  };
  const ask =
    ctx.round === 1
      ? `Round 1. For EVERY plan, accept or reject it for your person, with a private reason and a preference 1-5 (5 = love it). Reject anything that breaks a private rule.
Reply: {"verdicts":[{"planId":"...","decision":"accept|reject","privateReason":"...","preference":1-5}],"publicLine":{"text":"...","sourceIds":["..."]}}`
      : `Round ${ctx.round}. The leading plan is ${ctx.leadingPlanId}. Decide: "sign" it, "concede" to it (not your favourite but acceptable), or "hold" for a plan you prefer (give its id).
Reply: {"decision":"sign|concede|hold","planId":"...","privateReason":"...","publicLine":{"text":"...","sourceIds":["..."]}}`;
  return `${JSON.stringify(view)}\n\n${ask}`;
}

/* ------------------------------ the calls ------------------------------ */

function audited(ctx: TurnContext): { user: string; context?: ContextAudit } {
  const user = promptFor(ctx);
  if (!flag("CONTEXT_AUDIT")) return { user };
  keepPrompt(ctx.partyId, ctx.brief.ownerId, ctx.round, SYSTEM, user);
  return { user, context: auditContext(user, ctx.partyId, ctx.brief.ownerId) };
}

export async function round1Turn(ctx: TurnContext): Promise<TurnResult<Round1Out>> {
  const { user, context } = audited(ctx);
  const r = await callModel({
    role: "spark",
    task: "table.round1",
    agent: ctx.brief.ownerId,
    system: SYSTEM,
    user,
    schema: Round1Out,
    mock: () => mockRound1(ctx),
    fallback: () => mockRound1(ctx),
  });
  // Every plan must have exactly one verdict; fill gaps from the deterministic agent.
  const base = mockRound1(ctx);
  const verdicts = ctx.plans.map((p) => r.value.verdicts.find((v) => v.planId === p.id) ?? base.verdicts.find((v) => v.planId === p.id)!);
  return { out: { verdicts, publicLine: r.value.publicLine }, source: r.source, ms: r.ms, note: r.note, context };
}

export async function laterTurn(ctx: TurnContext): Promise<TurnResult<LaterOut>> {
  const { user, context } = audited(ctx);
  const r = await callModel({
    role: "spark",
    task: `table.round${ctx.round}`,
    agent: ctx.brief.ownerId,
    system: SYSTEM,
    user,
    schema: LaterOut,
    mock: () => mockLater(ctx),
    fallback: () => mockLater(ctx),
  });
  return { out: r.value, source: r.source, ms: r.ms, note: r.note, context };
}
