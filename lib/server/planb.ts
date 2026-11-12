import type { CandidatePlan } from "@/contracts";
import { feasibleFor, rankPlans } from "@/lib/agents/judge";
import { flag } from "@/lib/flags";
import { clock12 } from "@/lib/format";
import { store } from "./store";

/**
 * Plan B (F53). Nights break: a packed market, rain, a venue that closes
 * early. Code picks the next-best plan the same way it picked the first:
 * it passes every member's rules (code checks), nobody's agent turned it
 * down, ranked by the same preference totals. It says nothing about anyone:
 * only that this plan also fits everyone.
 */
export interface PlanB {
  planId: string;
  title: string;
  when: string;
  venueName: string;
}

export function planB(partyId: string): PlanB | null {
  if (!flag("PLAN_B")) return null;
  const s = store();
  const party = s.parties.get(partyId);
  if (!party || party.status !== "locked" || !party.planId) return null;
  const briefs = party.memberIds.map((id) => s.briefs.get(`brief-${id}`)).filter((b): b is NonNullable<typeof b> => !!b);
  if (briefs.length !== party.memberIds.length) return null;
  const r1 = s.verdicts.filter((v) => v.partyId === partyId && v.round === 1);
  const turnedDown = new Set(r1.filter((v) => v.decision === "reject").map((v) => v.planId));
  const totals = new Map<string, number>();
  for (const v of r1) totals.set(v.planId, (totals.get(v.planId) ?? 0) + v.preference);
  const plans = party.candidatePlanIds
    .map((id) => s.plans.get(id))
    .filter((p): p is CandidatePlan => !!p && p.id !== party.planId && !turnedDown.has(p.id) && feasibleFor(partyId, p, briefs));
  const b = rankPlans(plans, totals)[0];
  return b ? { planId: b.id, title: b.title, when: `${clock12(b.start)}–${clock12(b.end)}`, venueName: b.venueName } : null;
}

export const planBLine = (main: string, b: PlanB) => `Plan B, if ${main} doesn't work out: ${b.title} · ${b.when} · ${b.venueName}. It fits everyone's rules too.`;
