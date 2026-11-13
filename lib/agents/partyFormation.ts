/**
 * Party Formation Agent. The queue engine proposes candidate groups; this agent reviews them
 * with tools (getProfiles, scoreGroup, checkSafetyRules), picks one and explains why.
 * Tools are executed by code (cheap, deterministic, zero LLM calls); the model sees their
 * outputs and makes ONE decision call. Code re-checks safety on whatever it picks.
 */
import { z } from "zod";
import { runAi } from "@/lib/ai";
import type { Candidate, Proposal } from "@/lib/match/engine";
import { validateParty } from "@/lib/match/safety";
import type { Person } from "@/lib/profile/load";
import type { TraceStep } from "@/lib/server/trace";
import { firstName, fmtWindow, label, publicProfile } from "./describe";
import { againPairsIn, type PairSignals } from "@/lib/match/ratings";

const AGENT = "party_formation";
const Decision = z.object({ choice: z.number().int().min(0), rationale: z.string().min(5).max(400) });

export interface FormationResult {
  candidate: Candidate;
  rationale: string;
  steps: TraceStep[];
  source: string;
}

const RATING_TALK = /\b(rat(ed|ing|ings)|squad up again|said (they|you)'?d)\b/i;
const letter = (i: number) => String.fromCharCode(65 + i);

/** Deterministic rationale used offline / when the model is unavailable. */
export function templateRationale(c: Candidate) {
  const tags = c.cohesion.sharedTags.slice(0, 3).map((t) => label(t.tag).toLowerCase());
  const w = c.cohesion.bestWindow;
  return `Everyone here shares ${tags.join(", ") || "overlapping interests"}${w ? ` and is free ${fmtWindow(w)}` : ""}. Nobody is a weak link: the lowest pairwise match is ${Math.round(c.cohesion.minPairwise * 100)}%.`;
}

export async function partyFormationAgent(p: Proposal, people: Map<string, Person>, signals?: PairSignals): Promise<FormationResult> {
  const steps: TraceStep[] = [];
  const allIds = [...new Set(p.candidates.flatMap((c) => c.userIds))];
  const profiles = allIds.map((id) => publicProfile(people.get(id)!));
  steps.push({
    agent: AGENT, kind: "tool_call", toolName: "getProfiles", input: { userIds: allIds },
    output: profiles.map((x) => ({ name: x.name, topInterests: x.topInterests.slice(0, 3) })),
    summary: `Loaded ${allIds.length} taste profiles (interests, dislikes, availability — sensitive data excluded)`,
  });

  const scored = p.candidates.map((c, i) => {
    const out = {
      group: letter(i),
      cohesion: c.cohesion.score,
      avgPairwise: c.cohesion.avgPairwise,
      minPairwise: c.cohesion.minPairwise,
      sharedInterests: c.cohesion.sharedTags.slice(0, 5).map((t) => `${label(t.tag)} (${t.count}/${c.userIds.length})`),
      sharedWindow: c.cohesion.bestWindow ? fmtWindow(c.cohesion.bestWindow) : null,
      // Post-event ratings: pairs in this group who said they'd squad up again (a count, never names).
      // Only present when nonzero, so prompts without ratings (and their saved replies) are unchanged.
      ...(signals && againPairsIn(c.userIds, signals) ? { squadUpAgainPairs: againPairsIn(c.userIds, signals) } : {}),
    };
    steps.push({ agent: AGENT, kind: "tool_call", toolName: "scoreGroup", input: { group: letter(i), members: c.userIds }, output: out,
      summary: `Group ${letter(i)}: cohesion ${Math.round(c.cohesion.score * 100)}%, weakest pair ${Math.round(c.cohesion.minPairwise * 100)}%${out.squadUpAgainPairs ? ", past ratings favor it" : ""}` });
    return out;
  });

  const safety = p.candidates.map((c, i) => {
    const r = validateParty(c.userIds.map((u) => people.get(u)!));
    steps.push({ agent: AGENT, kind: "tool_call", toolName: "checkSafetyRules", input: { group: letter(i) }, output: r,
      summary: `Group ${letter(i)}: ${r.ok ? "passes age-band, women-only and block rules" : `violates ${r.violations.map((v) => v.rule).join(", ")}`}` });
    return r;
  });

  const options = p.candidates.map((c, i) => ({
    group: letter(i),
    members: c.userIds.map((u) => publicProfile(people.get(u)!)).map(({ name, topInterests, socialStyle }) => ({ name, topInterests, socialStyle })),
    score: scored[i],
    safe: safety[i].ok,
  }));

  const ai = await runAi({
    task: "party_formation",
    system:
      "You are the Party Formation Agent inside Facebook Events' Queue Up feature. You pick which candidate group of strangers should go to an event together. Prefer groups where everyone has something in common with everyone else (high weakest-pair score) over a high average. Never pick a group marked safe=false. Never mention or infer politics, religion, health or sexuality. Reply with JSON only: {\"choice\": <index of group, 0-based>, \"rationale\": \"<max 2 friendly sentences addressed to the group, citing concrete shared interests>\"}.",
    user: JSON.stringify({
      partySize: p.targetSize,
      ...(options.some((o) => o.score.squadUpAgainPairs) ? { ratingsNote: "squadUpAgainPairs counts pairs who privately said they'd squad up again after a past night out. Favor those groups, but never mention ratings in the rationale." } : {}),
      candidates: options,
    }),
    schema: Decision,
    fallback: () => ({ choice: 0, rationale: templateRationale(p.candidates[0]) }),
    maxTokens: 220,
    temperature: 0.3,
  });

  let idx = ai.value.choice;
  let rationale = ai.value.rationale;
  // Ratings are private: a rationale that talks about them is replaced (it's shown to the whole squad).
  if (RATING_TALK.test(rationale) && idx < p.candidates.length) rationale = templateRationale(p.candidates[idx]);
  steps.push({ agent: AGENT, kind: "reasoning", output: { choice: letter(idx), source: ai.source }, summary: rationale });

  // Code has the last word on safety.
  const pickedOk = idx < p.candidates.length && validateParty(p.candidates[idx].userIds.map((u) => people.get(u)!)).ok;
  if (!pickedOk) {
    const reason = idx >= p.candidates.length ? "not one of the proposed groups" : "fails safety rules";
    idx = safety.findIndex((s) => s.ok);
    if (idx < 0) idx = 0;
    rationale = templateRationale(p.candidates[idx]);
    steps.push({ agent: AGENT, kind: "safety_check", output: { rejected: true, reason }, summary: `Agent's pick rejected (${reason}); using safest top-scoring group ${letter(idx)}` });
  } else {
    steps.push({ agent: AGENT, kind: "safety_check", output: { rejected: false }, summary: `Re-checked group ${letter(idx)} in code: all hard safety rules pass` });
  }

  const chosen = p.candidates[idx];
  steps.push({
    agent: AGENT, kind: "decision", output: { group: letter(idx), members: chosen.userIds },
    summary: `Formed a squad of ${chosen.userIds.length}: ${chosen.userIds.map((u) => firstName(people.get(u)!)).join(", ")}`,
  });
  return { candidate: chosen, rationale, steps, source: ai.source };
}
