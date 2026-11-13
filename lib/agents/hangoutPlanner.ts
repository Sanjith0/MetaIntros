/**
 * Hangout Planner Agent (the "new hangout" queue). Code builds and verifies every option
 * (public spot near everyone, shared free time, opening hours, no dislikes — lib/match/hangoutFit);
 * the model picks one and names it in a single call. Its pick is re-validated, and its title/blurb
 * are length-capped and filtered for sensitive content, with template text as the fallback.
 */
import { z } from "zod";
import { runAi } from "@/lib/ai";
import { isSensitiveText } from "@/lib/cards/claims";
import { rankHangouts, type HangoutGroup, type HangoutOption, type Spot } from "@/lib/match/hangoutFit";
import type { TraceStep } from "@/lib/server/trace";
import { fmtWindow, label } from "./describe";

const AGENT = "hangout_planner";
const Pick = z.object({
  choice: z.string(),
  title: z.string().min(3).max(80),
  plan: z.string().min(3).max(240),
  reasons: z.array(z.string().max(200)).min(1).max(3),
});

export interface HangoutPlan {
  spot: Spot;
  option: HangoutOption & { startsAt: Date; endsAt: Date };
  title: string;
  plan: string;
  reasons: string[];
  runnersUp: string[];
  steps: TraceStep[];
  source: string;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const when = (d: Date) => `${DAYS[d.getDay()]} ${d.getHours() % 12 || 12}${d.getMinutes() ? ":" + String(d.getMinutes()).padStart(2, "0") : ""}${d.getHours() < 12 ? "am" : "pm"}`;

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const templateTitle = (spot: Spot, o: HangoutOption) =>
  `${o.matchedTags[0] ? label(o.matchedTags[0]) : "Squad"} hangout at ${spot.name}`.slice(0, 60);
export const templatePlan = (spot: Spot, o: HangoutOption) =>
  `${cap(spot.activity)} at ${spot.name}${o.startsAt ? `, ${when(o.startsAt)}` : ""}. Planned by Link for your squad.`;

function templateReasons(o: HangoutOption, g: HangoutGroup) {
  const r = o.matchedTags.slice(0, 2).map((t) => `${g.tagCounts.get(t)}/${g.size} of you are into ${label(t).toLowerCase()}`);
  r.push(o.maxKm < 1 ? "Right in everyone's area" : `Within ${o.maxKm.toFixed(1)} km of everyone`);
  return r.slice(0, 3);
}

/** Sanitize model text: trim, cap length, and drop anything touching sensitive categories. */
function clean(text: string, max: number, fallback: string) {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t || isSensitiveText(t)) return fallback;
  return t.length > max ? t.slice(0, max - 1).trimEnd() + "…" : t;
}

export async function hangoutPlannerAgent(input: { spots: Spot[]; group: HangoutGroup; now: Date; horizon: Date }): Promise<HangoutPlan | null> {
  const { spots, group, now, horizon } = input;
  const steps: TraceStep[] = [];
  const ranked = rankHangouts(spots, group, now, horizon);
  const ok = ranked.filter((r) => r.ok) as (HangoutOption & { startsAt: Date; endsAt: Date })[];
  const rejected = ranked.filter((r) => !r.ok).flatMap((r) => r.rejections).reduce<Record<string, number>>((m, r) => {
    const k = r.startsWith("a member dislikes") ? "a member dislikes it" : r.startsWith("too far") ? "too far for someone" : r;
    m[k] = (m[k] ?? 0) + 1;
    return m;
  }, {});
  steps.push({
    agent: AGENT, kind: "tool_call", toolName: "findCommonGround", input: { areas: group.memberAreas.length, spots: spots.length },
    output: { ok: ok.map((o) => o.spotId), rejected },
    summary: `${ok.length} public spots are near everyone and open in your shared free time${group.sharedWindows[0] ? ` (${group.sharedWindows.map(fmtWindow).slice(0, 2).join(", ")})` : ""}; filtered out ${Object.entries(rejected).map(([k, v]) => `${v} × ${k}`).join(", ") || "none"}`,
  });
  if (!ok.length) return null;

  const spotOf = (id: string) => spots.find((s) => s.id === id)!;
  const options = ok.slice(0, 5).map((o) => {
    const s = spotOf(o.spotId);
    return { id: s.id, place: s.name, activity: s.activity, when: when(o.startsAt), interests: o.matchedTags.map(label), farthestKm: Number(o.maxKm.toFixed(1)) };
  });
  const groupInterests = [...group.tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([t, n]) => `${label(t)} (${n}/${group.size})`);
  const fallback = () => ({ choice: ok[0].spotId, title: templateTitle(spotOf(ok[0].spotId), ok[0]), plan: templatePlan(spotOf(ok[0].spotId), ok[0]), reasons: templateReasons(ok[0], group) });
  const ai = await runAi({
    task: "hangout_planner",
    system:
      "You are the Hangout Planner for Queue Up on Facebook. A squad of strangers wants to hang out; there is no existing event, so you plan one. Choose the single best option (all are already verified: public, near everyone, inside everyone's free time). Favor what most of them are into and what makes conversation easy for strangers. Write a short, friendly title (max 60 chars) and a one-sentence plan. Never mention politics, religion, health or sexuality. Reply with JSON only: {\"choice\": \"<option id>\", \"title\": \"...\", \"plan\": \"...\", \"reasons\": [\"<short reason>\", \"<short reason>\"]}.",
    user: JSON.stringify({ squadSize: group.size, squadInterests: groupInterests, options }),
    schema: Pick,
    fallback,
    maxTokens: 260,
    temperature: 0.5,
  });

  let pick = ai.value;
  const okIds = new Set(ok.map((o) => o.spotId));
  steps.push({ agent: AGENT, kind: "reasoning", output: { choice: pick.choice, source: ai.source }, summary: pick.reasons.join(" · ") });
  if (!okIds.has(pick.choice)) {
    const bad = ranked.find((r) => r.spotId === pick.choice);
    const why = bad ? bad.rejections.join("; ") || "not in the verified list" : "unknown place";
    pick = fallback();
    steps.push({ agent: AGENT, kind: "safety_check", output: { rejected: true, reason: why }, summary: `Planner's pick rejected (${why}); using the best verified spot` });
  } else {
    steps.push({ agent: AGENT, kind: "safety_check", output: { rejected: false }, summary: "Re-checked in code: public place, near everyone, inside shared free time, no dislikes" });
  }
  const option = ok.find((o) => o.spotId === pick.choice)!;
  const spot = spotOf(option.spotId);
  const title = clean(pick.title, 60, templateTitle(spot, option));
  const plan = clean(pick.plan, 240, templatePlan(spot, option));
  const reasons = pick.reasons.map((r) => clean(r, 200, "")).filter(Boolean);
  const runnersUp = ok.filter((o) => o.spotId !== option.spotId).slice(0, 2).map((o) => o.spotId);
  steps.push({
    agent: AGENT, kind: "decision", output: { spotId: spot.id, startsAt: option.startsAt, assumedTime: option.assumedTime },
    summary: `Planned "${title}" at ${spot.name}, ${when(option.startsAt)}${option.assumedTime ? " (no shared free time on file, so we suggested a weekend afternoon)" : ""}`,
  });
  return { spot, option, title, plan, reasons: reasons.length ? reasons : templateReasons(option, group), runnersUp, steps, source: ai.source };
}
