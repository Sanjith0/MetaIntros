import type { CandidatePlan, HardRule } from "@/contracts";
import { clock12, eveningMinutes } from "@/lib/format";
import { store } from "./store";

/**
 * Closest fit (F45). When nothing there fits your own rules, code finds the
 * plan that needs the smallest change to them, and says what the change is,
 * in your own terms. Built only from your own rules and the plans' public
 * facts, and shown only to you.
 */
export interface ClosestFit {
  planTitle: string;
  changes: string[];
}

function gap(plan: CandidatePlan, r: HardRule): { text: string; cost: number } | null {
  switch (r.kind) {
    case "end_by": {
      const late = eveningMinutes(plan.end) - eveningMinutes(r.value);
      return late > 0 ? { text: `stay until ${clock12(plan.end)} (you said “${r.sourceText}”)`, cost: late } : null;
    }
    case "max_price": {
      const over = plan.priceUsd - r.value;
      return over > 0 ? { text: `spend $${plan.priceUsd} (you said “${r.sourceText}”)`, cost: over * 4 } : null;
    }
    case "no_drink_minimum":
      return plan.drinkMinimum ? { text: `go somewhere with a drink minimum (you said “${r.sourceText}”)`, cost: 120 } : null;
    case "public_venue":
      return null; // a safety rule: never relaxed
  }
}

export function closestFit(partyId: string, userId: string): ClosestFit | null {
  const s = store();
  const party = s.parties.get(partyId);
  const brief = s.briefs.get(`brief-${userId}`);
  if (!party || !brief || !party.memberIds.includes(userId)) return null;
  const plans = party.candidatePlanIds.map((id) => s.plans.get(id)).filter((p): p is CandidatePlan => !!p && p.venueKind === "public");
  const ranked = plans
    .map((plan) => {
      const gaps = brief.hardRules.map((r) => gap(plan, r)).filter((g): g is { text: string; cost: number } => !!g);
      return { plan, gaps, cost: gaps.length * 1000 + gaps.reduce((n, g) => n + g.cost, 0) };
    })
    .filter((x) => x.gaps.length > 0)
    .sort((a, b) => a.cost - b.cost || eveningMinutes(a.plan.start) - eveningMinutes(b.plan.start));
  const best = ranked[0];
  return best ? { planTitle: best.plan.title, changes: best.gaps.map((g) => g.text) } : null;
}
