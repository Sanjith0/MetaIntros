import { auditContext } from "@/lib/agents/audit";
import { ownerChecks } from "@/lib/agents/judge";
import { runParty } from "@/lib/agents/orchestrator";
import { simulateGuests } from "@/lib/server/fair";
import { secretView } from "@/lib/server/secret";
import { runIsolated, store } from "@/lib/server/store";
import { realCallsUsed, withMockModel } from "@/model/client";

/**
 * A whole fair through the real loop (F30). N fictional guests scan in and
 * queue; code forms parties; every party's five agents talk at once; code
 * locks; MATCH FOUND goes out. All in a sandbox store on the mock model:
 * no real calls, nothing live touched. Then the same checks the demo makes,
 * across every party: every locked plan passes every member's rules, and no
 * member can load anyone else's private words.
 */
export interface ScaleResult {
  guests: number;
  parties: number;
  locked: number;
  noMatch: number;
  waiting: number;
  /** Wall-clock, ms: everyone joined and parties formed; then every table talk to its lock. */
  formMs: number;
  talkMs: number;
  /** Server time from a party's lock to its MATCH FOUND going out. */
  matchLagMs: { p50: number; p95: number; max: number };
  agentTurns: number;
  /** Locked plans that break someone's rule. Expected 0. */
  invalidPlans: number;
  /** Members checked with the "what the party knows" scan, and what it found. Expected 0. */
  scanned: number;
  leaks: number;
  /** Prompts that held another member's private words. Expected 0. */
  promptLeaks: number;
  realCalls: number;
}

const pct = (xs: number[], p: number) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor((p / 100) * xs.length))]! : 0);

export const MAX_GUESTS = 300;

export async function runScale(n = 100): Promise<ScaleResult> {
  const guests = Math.max(5, Math.min(MAX_GUESTS, Math.round(n)));
  const callsBefore = realCallsUsed();
  return withMockModel(() =>
    runIsolated(async () => {
      const t0 = Date.now();
      await simulateGuests(guests, false);
      const t1 = Date.now();
      const s = store();
      const ids = [...s.parties.keys()];
      await Promise.all(ids.map((id) => runParty(id, { paceMs: 0 })));
      const t2 = Date.now();

      const parties = [...s.parties.values()];
      const locked = parties.filter((p) => p.status === "locked");
      const lockAt = new Map(s.events_log.filter((e) => e.type === "plan.locked").map((e) => [(e.payload as { partyId: string }).partyId, Date.parse(e.at)]));
      const lags = s.events_log
        .filter((e) => e.type === "match.found")
        .map((e) => Date.parse(e.at) - (lockAt.get((e.payload as { partyId: string }).partyId) ?? Date.parse(e.at)));
      let invalidPlans = 0;
      let scanned = 0;
      let leaks = 0;
      for (const p of locked) {
        const plan = s.plans.get(p.planId!)!;
        if (p.memberIds.some((m) => !ownerChecks(p.id, plan, s.briefs.get(`brief-${m}`)!).every((c) => c.pass))) invalidPlans++;
        for (const m of p.memberIds) {
          const v = secretView(p.id, m);
          if (!v) continue;
          scanned++;
          leaks += v.partyKnows.length;
        }
      }
      const promptLeaks = [...s.prompts.entries()].reduce((sum, [k, pr]) => sum + auditContext(pr.user, k.split(":")[0]!, k.split(":")[1]!).others.length, 0);
      return {
        guests,
        parties: parties.length,
        locked: locked.length,
        noMatch: parties.filter((p) => p.status === "failed").length,
        waiting: s.queue.filter((e) => e.status === "waiting").length,
        formMs: t1 - t0,
        talkMs: t2 - t1,
        matchLagMs: { p50: pct(lags, 50), p95: pct(lags, 95), max: lags.length ? Math.max(...lags) : 0 },
        agentTurns: s.agentCalls.length,
        invalidPlans,
        scanned,
        leaks,
        promptLeaks,
        realCalls: realCallsUsed() - callsBefore,
      };
    }),
  );
}
