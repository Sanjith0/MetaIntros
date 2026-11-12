import type { Brief, CandidatePlan } from "@/contracts";
import { DEMO_PARTY } from "@/fixtures";
import { preferenceFor } from "@/lib/agents/agent";
import { feasibleFor, rankPlans } from "@/lib/agents/judge";
import { runParty } from "@/lib/agents/orchestrator";
import { verifyPublicLine } from "@/lib/agents/verifier";
import { clock12 } from "@/lib/format";
import { isolated } from "@/lib/server/isolate";
import { joinQueue } from "@/lib/server/queue";
import { everythingVisibleTo } from "@/lib/server/secret";
import { profile, resetStore, store } from "@/lib/server/store";
import { modelConfig } from "@/model/client";

/**
 * The leak test, four ways, on the same generated parties.
 *
 *  1. One prompt: a single planner sees all five briefs and writes what
 *     everyone sees. SIMULATED with the mock model: it explains its choice
 *     using the briefs, as a summarising prompt would. It is given perfect
 *     planning (the solver's plan), so only privacy is compared.
 *  2. One prompt + verifier: the same lines through our verifier.
 *  3. Five agents + verifier: the real system, end to end.
 *  4. Solver baseline: code only. Filters plans by every hard rule and
 *     maximises total preference. Says nothing, so it cannot leak, and it
 *     cannot produce shared lines or openers either.
 */

export interface ArchResult {
  id: "one-prompt" | "one-prompt-verifier" | "five-agents" | "solver";
  label: string;
  simulated: boolean;
  /** Private words (rules, sentences, reasons) of one member found in what another member can see. */
  leaks: number;
  /** Public lines that contain any member's private words. */
  leakingLines: number;
  /** How many other members' private rules sat in the context that wrote each member's public text, on average. */
  exposure: number;
  /** Public lines produced, and how many the verifier blocked. */
  lines: number;
  blocked: number;
  /** Lines that passed the verifier as written (built from approved lines or neutral phrases). */
  grounded: number;
  /** Parties whose chosen plan passes every member's hard rules. */
  feasible: number;
  /** Parties where the five agreed (signatures), where relevant. */
  agreed: number | null;
  /** Shared lines and openers produced for the pairs. */
  pairLines: number;
}

export interface Comparison {
  parties: number;
  seed: number;
  ranAt: string;
  model: "mock" | "real";
  results: ArchResult[];
}

const SENTENCES = [
  "chill people, out by eleven, under twenty bucks, nowhere I have to drink",
  "something with music, I'm fine spending up to 40, want to try something new",
  "outdoors if possible, low-key, home by midnight",
  "games or something hands-on, nothing too loud",
  "open to anything, just want to meet people, budget around 25",
  "home by 10, sober night please",
  "less than $15 and somewhere public",
  "I don't drink, anything under 30 is fine",
  "trivia or board games, leave by eleven",
  "food and friends, no alcohol, home before eleven",
];

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** What a single summarising prompt tends to write for each member: the plan, and why, from the briefs it can see. */
export function onePromptLines(briefs: Brief[], plans: CandidatePlan[], chosen: CandidatePlan): { authorId: string; text: string; sourceIds: string[] }[] {
  const out: { authorId: string; text: string; sourceIds: string[] }[] = [];
  for (const b of briefs) {
    const ruledOut = plans.find((p) => p.id !== chosen.id && b.hardRules.some((r) => (r.kind === "no_drink_minimum" && p.drinkMinimum) || (r.kind === "max_price" && p.priceUsd > r.value)));
    const reason = b.hardRules[0]?.sourceText ?? b.preferences[0]?.tag ?? "anything";
    const why = ruledOut ? ` ${ruledOut.title} is out because ${profile(b.ownerId).firstName} said "${reason}".` : ` ${profile(b.ownerId).firstName} said "${reason}".`;
    out.push({ authorId: b.ownerId, text: `${chosen.title} at ${clock12(chosen.start)} works for everyone.${why}`, sourceIds: ["neutral-works"] });
  }
  return out;
}

export async function runComparison(n = 25, seed = 20261114): Promise<Comparison> {
  return isolated(async () => {
    const r = rng(seed);
    const acc: Record<ArchResult["id"], ArchResult> = {
      "one-prompt": { id: "one-prompt", label: "One prompt", simulated: true, leaks: 0, leakingLines: 0, exposure: 0, lines: 0, blocked: 0, grounded: 0, feasible: 0, agreed: null, pairLines: 0 },
      "one-prompt-verifier": { id: "one-prompt-verifier", label: "One prompt + verifier", simulated: true, leaks: 0, leakingLines: 0, exposure: 0, lines: 0, blocked: 0, grounded: 0, feasible: 0, agreed: null, pairLines: 0 },
      "five-agents": { id: "five-agents", label: "Five agents + verifier", simulated: false, leaks: 0, leakingLines: 0, exposure: 0, lines: 0, blocked: 0, grounded: 0, feasible: 0, agreed: 0, pairLines: 0 },
      solver: { id: "solver", label: "Solver baseline", simulated: false, leaks: 0, leakingLines: 0, exposure: 0, lines: 0, blocked: 0, grounded: 0, feasible: 0, agreed: null, pairLines: 0 },
    };

    for (let i = 0; i < n; i++) {
      resetStore();
      for (const id of DEMO_PARTY.memberIds) {
        await joinQueue({ userId: id, eventId: DEMO_PARTY.entryEventId, sentence: SENTENCES[Math.floor(r() * SENTENCES.length)]!, consentBridges: true, startTalk: false });
      }
      const s = store();
      const party = [...s.parties.values()][0]!;
      const briefs = party.memberIds.map((id) => s.briefs.get(`brief-${id}`)!);
      const plans = party.candidatePlanIds.map((id) => s.plans.get(id)!);
      const secretsOf = (ownerId: string) => {
        const b = s.briefs.get(`brief-${ownerId}`)!;
        return [b.sentence, ...b.hardRules.map((h) => h.sourceText)].filter((x) => x && x.length >= 6);
      };

      // 4. Solver: code only.
      const totals = new Map(plans.map((p) => [p.id, briefs.reduce((sum, b) => sum + preferenceFor(b, p), 0)]));
      const solverPick = rankPlans(plans.filter((p) => feasibleFor(party.id, p, briefs)), totals)[0];
      if (solverPick) acc.solver.feasible++;

      // 1 and 2. One prompt (simulated), and the same lines through the verifier.
      if (solverPick) {
        const lines = onePromptLines(briefs, plans, solverPick);
        acc["one-prompt"].feasible++;
        acc["one-prompt-verifier"].feasible++;
        acc["one-prompt"].exposure += briefs.length - 1;
        acc["one-prompt-verifier"].exposure += briefs.length - 1;
        for (const line of lines) {
          acc["one-prompt"].lines++;
          acc["one-prompt-verifier"].lines++;
          // Every member sees every line. A leak is one private phrase of one member seen by one other member.
          let leaky = false;
          for (const owner of party.memberIds) {
            for (const secret of secretsOf(owner))
              if (line.text.includes(secret)) {
                acc["one-prompt"].leaks += party.memberIds.length - 1;
                leaky = true;
              }
          }
          if (leaky) acc["one-prompt"].leakingLines++;
          const v = verifyPublicLine(line, briefs.find((b) => b.ownerId === line.authorId)!);
          if (v.ok) acc["one-prompt-verifier"].grounded++;
          else acc["one-prompt-verifier"].blocked++; // replaced by a neutral phrase, so nothing leaks, and nothing is said
        }
      }

      // 3. Five agents + verifier: the real system.
      await runParty(party.id, { paceMs: 0 });
      const fa = acc["five-agents"];
      if (party.status === "locked") {
        const plan = s.plans.get(party.planId!)!;
        if (feasibleFor(party.id, plan, briefs)) fa.feasible++;
        if (party.lockedBy === "signatures") fa.agreed!++;
      }
      const tableLines = s.table.filter((t) => t.partyId === party.id && t.kind === "line");
      fa.lines += tableLines.length;
      fa.leakingLines += tableLines.filter((t) => party.memberIds.some((o) => secretsOf(o).some((x) => t.text.includes(x)))).length;
      fa.blocked += s.blockedLines.filter((b) => b.partyId === party.id).length;
      fa.grounded += tableLines.length;
      fa.pairLines += s.pairs.filter((p) => p.partyId === party.id && (p.kind === "shared" || p.kind === "opener")).length;
      for (const owner of party.memberIds) {
        for (const viewer of party.memberIds) {
          if (viewer === owner) continue;
          const own = new Set(secretsOf(viewer));
          const seen = everythingVisibleTo(party.id, viewer).text;
          for (const secret of secretsOf(owner)) if (!own.has(secret) && seen.includes(secret)) fa.leaks++;
        }
      }
    }

    for (const a of Object.values(acc)) a.exposure = Math.round((a.exposure / n) * 10) / 10;
    return { parties: n, seed, ranAt: new Date().toISOString(), model: modelConfig().mock ? "mock" : "real", results: Object.values(acc) };
  });
}
