import { preferenceFor } from "@/lib/agents/agent";
import { feasibleFor, rankPlans } from "@/lib/agents/judge";
import { ruleLabel } from "./secret";
import { clock12, price } from "@/lib/format";
import { store } from "./store";

/**
 * "Why this plan", built only from code: the judge's checks, the plan's own
 * facts, and the signatures. No model wrote any of it. The viewer sees their
 * own rule checks; everyone else's rules appear only as "all passed".
 */
export interface WhyLine {
  id: string;
  text: string;
  ok: boolean;
  /** The code checks (or party records) this line is built from. */
  from: string[];
}

export interface WhyView {
  planTitle: string;
  lines: WhyLine[];
}

export function whyThisPlan(partyId: string, viewerId: string): WhyView | null {
  const s = store();
  const party = s.parties.get(partyId);
  if (!party || party.status !== "locked" || !party.planId || !party.memberIds.includes(viewerId)) return null;
  const plan = s.plans.get(party.planId)!;
  const briefs = party.memberIds.map((id) => s.briefs.get(`brief-${id}`)!);
  const checks = s.codeChecks.filter((c) => c.partyId === partyId && c.planId === plan.id);
  const lines: WhyLine[] = [];

  // Your own rules, one line each, with the plan's actual value.
  const mine = checks.filter((c) => c.ownerId === viewerId);
  const myBrief = s.briefs.get(`brief-${viewerId}`)!;
  for (const c of mine) {
    const rule = myBrief.hardRules.find((r) => r.id === c.ruleId);
    if (!rule) continue;
    const actual = rule.kind === "end_by" ? `ends ${clock12(plan.end)}` : rule.kind === "max_price" ? price(plan.priceUsd) : rule.kind === "no_drink_minimum" ? (plan.drinkMinimum ? "drink minimum" : "no drink minimum") : plan.venueKind;
    lines.push({ id: `mine-${c.ruleId}`, text: `Your rule "${ruleLabel(rule)}": ${actual}`, ok: c.pass, from: [c.ruleId] });
  }
  if (!mine.length) lines.push({ id: "mine-none", text: "You didn't set any rules, so any plan suited you.", ok: true, from: [myBrief.id] });

  // Everyone else's rules: only that they all passed.
  const others = checks.filter((c) => c.ownerId && c.ownerId !== viewerId);
  const othersOk = others.every((c) => c.pass);
  lines.push({
    id: "others",
    text: othersOk ? "Every other member's private rules: all passed (code checked; you don't see what they are)" : "Not every member's rules passed (code fallback)",
    ok: othersOk,
    // Not their rule ids: an id like "hr-dev-price" would say what kind of rule Dev has.
    from: ["judge"],
  });

  // Party-wide safety.
  const pub = checks.find((c) => c.ownerId === null && c.ruleKind === "public_venue");
  if (pub) lines.push({ id: "public", text: `Public venue: ${plan.venueName}`, ok: pub.pass, from: [pub.ruleId] });

  // Rank among plans that work for everyone, by total preference (no one's own number is shown).
  const plans = party.candidatePlanIds.map((id) => s.plans.get(id)!);
  const feasible = plans.filter((p) => feasibleFor(partyId, p, briefs));
  const totals = new Map(plans.map((p) => [p.id, briefs.reduce((sum, b) => sum + preferenceFor(b, p), 0)]));
  const rank = rankPlans(feasible, totals).findIndex((p) => p.id === plan.id) + 1;
  if (rank > 0) {
    lines.push({
      id: "rank",
      text: feasible.length === 1 ? "The only plan that worked for all five" : `Ranked ${rank === 1 ? "first" : `#${rank}`} of the ${feasible.length} plans that worked for all five, by the group's combined preference`,
      ok: rank === 1,
      from: feasible.map((p) => p.id),
    });
  }

  // How it was locked.
  const unavailable = s.table.filter((t) => t.partyId === partyId && t.kind === "unavailable").length;
  if (unavailable) lines.push({ id: "unavailable", text: `${unavailable} other ${unavailable === 1 ? "plan was" : "plans were"} unavailable (no reasons are shared)`, ok: true, from: ["table"] });
  lines.push({
    id: "lock",
    text: party.lockedBy === "signatures" ? `All five signed it` : s.operator.forceLock.has(partyId) ? "Locked early by the organiser; code picked it" : "No five signatures by round 3, so code picked it",
    ok: party.lockedBy === "signatures",
    from: [party.id],
  });

  return { planTitle: plan.title, lines };
}
