import type { Brief, CandidatePlan, CodeCheck, HardRule } from "@/contracts";
import { clock12, eveningMinutes } from "@/lib/format";

/**
 * Code is the judge. These checks run after every model turn and win over
 * whatever the model said.
 */

function checkRule(plan: CandidatePlan, rule: HardRule): { pass: boolean; detail: string } {
  switch (rule.kind) {
    case "end_by": {
      const pass = eveningMinutes(plan.end) <= eveningMinutes(rule.value);
      return { pass, detail: `Ends ${clock12(plan.end)}; must end by ${clock12(rule.value)}.` };
    }
    case "max_price": {
      const pass = plan.priceUsd <= rule.value;
      return { pass, detail: `Costs $${plan.priceUsd}; limit is $${rule.value}.` };
    }
    case "no_drink_minimum": {
      const pass = !plan.drinkMinimum;
      return { pass, detail: plan.drinkMinimum ? "Has a drink minimum." : "No drink minimum." };
    }
    case "public_venue": {
      const pass = plan.venueKind === "public";
      return { pass, detail: `Venue is ${plan.venueKind}.` };
    }
  }
}

/** One owner's hard rules against one plan. */
export function ownerChecks(partyId: string, plan: CandidatePlan, brief: Brief): CodeCheck[] {
  return brief.hardRules.map((r) => {
    const { pass, detail } = checkRule(plan, r);
    return { partyId, planId: plan.id, ownerId: brief.ownerId, ruleId: r.id, ruleKind: r.kind, pass, detail };
  });
}

/** Party-wide safety: every plan must be at a public venue. */
export function partyChecks(partyId: string, plan: CandidatePlan): CodeCheck[] {
  const { pass, detail } = checkRule(plan, { id: "party-public", kind: "public_venue", value: true, sourceText: "" });
  return [{ partyId, planId: plan.id, ownerId: null, ruleId: "party-public", ruleKind: "public_venue", pass, detail }];
}

export function feasibleFor(partyId: string, plan: CandidatePlan, briefs: Brief[]): boolean {
  return partyChecks(partyId, plan).every((c) => c.pass) && briefs.every((b) => ownerChecks(partyId, plan, b).every((c) => c.pass));
}

/** Highest total preference wins; ties go to the earlier start, then the lower price. */
export function rankPlans(plans: CandidatePlan[], totals: Map<string, number>): CandidatePlan[] {
  return [...plans].sort(
    (a, b) =>
      (totals.get(b.id) ?? 0) - (totals.get(a.id) ?? 0) ||
      eveningMinutes(a.start) - eveningMinutes(b.start) ||
      a.priceUsd - b.priceUsd ||
      a.id.localeCompare(b.id),
  );
}
