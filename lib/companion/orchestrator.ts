/**
 * The Orchestrator. It draws the circles (who talks to whom) and, after the Companions have
 * talked, proposed and deliberated, forms the final parties. Code has the last word: sizes,
 * safety rules, and "only people a member's Companion wanted" are enforced here, not by the model.
 */
import { z } from "zod";
import { runAi } from "@/lib/ai";
import { label } from "@/lib/agents/describe";
import { isSensitiveText } from "@/lib/cards/claims";
import { pairAllowed, validateParty } from "@/lib/match/safety";
import type { Person } from "@/lib/profile/load";
import { openView, type Brief } from "./brief";

export const MIN_CIRCLE = 8;
export const MAX_CIRCLE = 15;
export const MAX_ROOM = 30;
export const MAX_PICKS = 4;
export const MAX_DEEP = 5;
export const GAP = 25;
/**
 * Vectors shortlist, Companions decide: two Companions only talk if their people's similarity score
 * (profile vectors plus overlap, lib/match/compat) is at least this. Saves calls and prompt size in
 * rooms of people with unrelated interests.
 */
export const SIMILARITY_GATE = 0.65;
/**
 * Below this pair score the deterministic (fallback) Companion declines a squad at sign-off (see
 * rounds.groupRound). It matches the widest level of the queue engine's search (minPairwise 0.15
 * in lib/match/engine.ts LEVELS), so the stand-in never refuses a pair the baseline matcher accepts.
 * Real Muse Companions decide for themselves.
 */
export const SIGN_OFF_FLOOR = 15;

export interface Verdict {
  score: number;
  wouldEnjoy: string[];
  concerns: string[];
  needs: string[];
  talkTopics: string[];
  opener: string;
  confidence: "low" | "medium" | "high";
}
/** from → about → verdict */
export type Verdicts = Map<string, Map<string, Verdict>>;

export interface Circle {
  id: string;
  theme: string;
  members: string[];
}

export interface TableRow {
  id: string;
  by: string;
  members: string[];
  line: string;
  backers: string[];
}

export interface ProposedParty {
  members: string[];
  why: string;
}

export interface TableResponse {
  action: "back" | "amend" | "hold";
  proposalId?: string;
  members?: string[];
}

const first = (p: Pick<Person, "name">) => p.name.split(" ")[0];
export const setKey = (ids: string[]) => [...ids].sort().join(",");

/** Maps what a model wrote (an id, or a first name) to one of `ids`. Ambiguous or unknown → null. */
export function makeResolver(ids: string[], people: Map<string, Person>) {
  const idSet = new Set(ids);
  const byName = new Map<string, string | null>();
  for (const id of ids) {
    const n = first(people.get(id)!).toLowerCase();
    byName.set(n, byName.has(n) ? null : id);
  }
  return (v: unknown): string | null => {
    if (typeof v !== "string") return null;
    const t = v.trim();
    if (idSet.has(t)) return t;
    return byName.get(t.toLowerCase()) ?? null;
  };
}

/** The lower of the two Companions' scores; 0 if either has not judged the other. */
export function pairScore(v: Verdicts, a: string, b: string): number {
  const ab = v.get(a)?.get(b)?.score, ba = v.get(b)?.get(a)?.score;
  if (ab === undefined || ba === undefined) return 0;
  return Math.min(ab, ba);
}

function chunkEvenly(ids: string[], max: number): string[][] {
  const n = Math.ceil(ids.length / max);
  const out: string[][] = [];
  let at = 0;
  for (let i = 0; i < n; i++) {
    const size = Math.ceil((ids.length - at) / (n - i));
    out.push(ids.slice(at, at + size));
    at += size;
  }
  return out;
}

/** Repair whatever the model drew: real ids only, nobody twice, sizes in range. */
export function fixCircles(raw: { theme?: string; members?: unknown[] }[], ids: string[], people: Map<string, Person>, minSize: number): { circles: Circle[]; unplaced: string[] } {
  const resolve = makeResolver(ids, people);
  const seen = new Set<string>();
  const groups: { theme: string; members: string[] }[] = [];
  for (const c of raw) {
    const members: string[] = [];
    for (const m of c.members ?? []) {
      const id = resolve(m);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      members.push(id);
    }
    const theme = typeof c.theme === "string" && c.theme.trim() && !isSensitiveText(c.theme) ? c.theme.trim().slice(0, 120) : "People with a similar idea of a good night";
    for (const part of members.length > MAX_CIRCLE ? chunkEvenly(members, MAX_CIRCLE) : [members]) groups.push({ theme, members: part });
  }
  const kept = groups.filter((g) => g.members.length >= minSize);
  const placed = new Set(kept.flatMap((g) => g.members));
  return {
    circles: kept.map((g, i) => ({ id: `c${i + 1}`, theme: g.theme, members: g.members })),
    unplaced: ids.filter((id) => !placed.has(id)),
  };
}

const CirclesOut = z.object({ circles: z.array(z.object({ theme: z.string().optional(), members: z.array(z.any()).optional() })).max(8) });

function fallbackCircles(ids: string[], people: Map<string, Person>): { theme: string; members: string[] }[] {
  const top = (id: string) => people.get(id)!.profile.interestTags[0]?.tag ?? "";
  const sorted = [...ids].sort((a, b) => top(a).localeCompare(top(b)) || a.localeCompare(b));
  return chunkEvenly(sorted, MAX_CIRCLE).map((members) => {
    const counts = new Map<string, number>();
    for (const m of members) for (const t of people.get(m)!.profile.interestTags.slice(0, 3)) counts.set(t.tag, (counts.get(t.tag) ?? 0) + 1);
    const best = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 2).map(([t]) => label(t).toLowerCase());
    return { theme: best.length ? `Into ${best.join(" and ")}` : "People in your queue", members };
  });
}

/** Sort the room into circles of people who should all meet each other. */
export async function drawCircles(briefs: Map<string, Brief>, people: Map<string, Person>, targetSize: number, useModel: boolean): Promise<{ circles: Circle[]; unplaced: string[]; source: string }> {
  const ids = [...briefs.keys()].sort();
  if (ids.length <= MAX_CIRCLE) return { circles: [{ id: "c1", theme: "Everyone in your queue", members: ids }], unplaced: [], source: "code" };
  const minSize = Math.min(Math.max(targetSize, MIN_CIRCLE), ids.length);
  const fb = () => ({ circles: fallbackCircles(ids, people) });
  let raw: { theme?: string; members?: unknown[] }[] = fb().circles;
  let source = "template";
  if (useModel) {
    const ai = await runAi({
      task: "orchestrator_circles",
      system:
        `You are the Orchestrator inside Facebook Events' Queue Up. Sort the people waiting in a queue into circles of ${MIN_CIRCLE}-${MAX_CIRCLE}. Inside a circle every person's Companion agent will talk to every other, so group people who plausibly want the same kind of night, and keep some variety. Put each person in exactly one circle. Give each circle a short friendly theme (max 10 words). Use the ids given. Never mention or infer politics, religion, health or sexuality. JSON only: {"circles": [{"theme": "...", "members": ["<id>", ...]}]}.`,
      user: JSON.stringify({
        squadSize: targetSize,
        people: ids.map((id) => {
          const v = openView(briefs.get(id)!);
          return { id, name: v.name, energy: v.tonight.energy, into: v.facts.slice(0, 6).map((f) => f.text) };
        }),
      }),
      schema: CirclesOut,
      fallback: fb,
      maxTokens: 1500,
      temperature: 0.4,
      timeoutMs: 60_000,
    });
    raw = ai.value.circles;
    source = ai.source;
  }
  let fixed = fixCircles(raw, ids, people, minSize);
  if (!fixed.circles.length) {
    fixed = fixCircles(fallbackCircles(ids, people), ids, people, minSize);
    source = useModel ? "fallback" : source;
  }
  // Nobody is dropped just because the model forgot them: leftovers become their own circle or top up small ones.
  let left = fixed.unplaced;
  const circles = fixed.circles.map((c) => ({ ...c, members: [...c.members] }));
  if (left.length >= minSize) {
    for (const part of chunkEvenly(left, MAX_CIRCLE)) circles.push({ id: "", theme: "More people in your queue", members: part });
    left = [];
  } else {
    const rest: string[] = [];
    for (const id of left) {
      const room = circles.filter((c) => c.members.length < MAX_CIRCLE).sort((a, b) => a.members.length - b.members.length || a.id.localeCompare(b.id))[0];
      if (room) room.members.push(id);
      else rest.push(id);
    }
    left = rest;
  }
  return { circles: circles.map((c, i) => ({ ...c, id: `c${i + 1}`, members: [...c.members].sort() })), unplaced: left, source };
}

/** Which pairs get the longer conversation. */
export function deepPairs(picks: Map<string, string[]>, v: Verdicts, members: string[], people: Map<string, Person>): [string, string][] {
  const sorted = [...members].sort();
  const cands: { a: string; b: string; score: number }[] = [];
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i], b = sorted[j];
      if (!pairAllowed(people.get(a)!, people.get(b)!)) continue;
      const picked = picks.get(a)?.includes(b) || picks.get(b)?.includes(a);
      const ab = v.get(a)?.get(b)?.score, ba = v.get(b)?.get(a)?.score;
      const gap = ab !== undefined && ba !== undefined && Math.abs(ab - ba) >= GAP;
      if (picked || gap) cands.push({ a, b, score: pairScore(v, a, b) });
    }
  }
  cands.sort((x, y) => y.score - x.score || x.a.localeCompare(y.a) || x.b.localeCompare(y.b));
  const count = new Map<string, number>();
  const out: [string, string][] = [];
  for (const c of cands) {
    if ((count.get(c.a) ?? 0) >= MAX_DEEP || (count.get(c.b) ?? 0) >= MAX_DEEP) continue;
    count.set(c.a, (count.get(c.a) ?? 0) + 1);
    count.set(c.b, (count.get(c.b) ?? 0) + 1);
    out.push([c.a, c.b]);
  }
  return out.sort((x, y) => x[0].localeCompare(y[0]) || x[1].localeCompare(y[1]));
}

/** For each Companion: everyone in a group it proposed, amended to, or backed. */
export function wanted(table: TableRow[], responses: Map<string, TableResponse>): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  const add = (who: string, members: string[]) => {
    if (!members.includes(who)) return;
    const s = out.get(who) ?? new Set<string>();
    for (const m of members) if (m !== who) s.add(m);
    out.set(who, s);
  };
  for (const row of table) add(row.by, row.members);
  for (const [who, r] of responses) {
    if (r.action === "back") {
      const row = table.find((t) => t.id === r.proposalId);
      if (row) add(who, row.members);
    } else if (r.action === "amend" && r.members) add(who, r.members);
  }
  return out;
}

/**
 * Nobody is put in a squad unless a Companion chose it: either another member's Companion
 * proposed or backed a group containing them, or their own Companion chose every other member
 * (in which case the others still each sign off in the group conversation).
 */
export function chosen(id: string, group: string[], want: Map<string, Set<string>>): boolean {
  const others = group.filter((x) => x !== id);
  return others.some((x) => want.get(x)?.has(id)) || others.every((x) => want.get(id)?.has(x));
}

/** Keep only parties that pass every hard rule. */
export function validateParties(proposed: ProposedParty[], circle: string[], want: Map<string, Set<string>>, people: Map<string, Person>, targetSize: number, exclude: string[][], feasible: (members: string[]) => boolean = () => true): ProposedParty[] {
  const inCircle = new Set(circle);
  const excluded = new Set(exclude.map(setKey));
  const used = new Set<string>();
  const kept: ProposedParty[] = [];
  for (const p of proposed) {
    const m = p.members;
    if (m.length !== targetSize || new Set(m).size !== m.length) continue;
    if (m.some((id) => !inCircle.has(id) || used.has(id))) continue;
    if (excluded.has(setKey(m))) continue;
    if (!validateParty(m.map((id) => people.get(id)!)).ok) continue;
    if (!m.every((id) => chosen(id, m, want))) continue;
    if (!feasible(m)) continue; // e.g. no event or hangout slot this group could all make
    m.forEach((id) => used.add(id));
    kept.push(p);
  }
  return kept;
}

function templateWhy(members: string[], people: Map<string, Person>) {
  const counts = new Map<string, number>();
  for (const m of members) for (const t of people.get(m)!.profile.interestTags) counts.set(t.tag, (counts.get(t.tag) ?? 0) + 1);
  const shared = [...counts.entries()].filter(([, n]) => n >= Math.ceil(members.length / 2)).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3).map(([t]) => label(t).toLowerCase());
  return `Your Companions kept picking each other after talking it through${shared.length ? `. Most of you are into ${shared.join(", ")}` : ""}.`;
}

export interface FormInput {
  circle: Circle;
  table: TableRow[];
  want: Map<string, Set<string>>;
  verdicts: Verdicts;
  briefs: Map<string, Brief>;
  people: Map<string, Person>;
  targetSize: number;
  exclude: string[][];
  attempt: number;
  useModel: boolean;
  /** people to place first (real people ahead of simulated fillers) */
  priority?: string[];
  /** only form squads that include a priority person */
  onlyPriority?: boolean;
  /** can this group actually meet? (a shared slot and a place); checked by code, defaults to yes */
  feasible?: (members: string[]) => boolean;
}

/**
 * Deterministic Orchestrator: build squads from who wanted whom. Starting from each person
 * (priority people first), take the best of (a) an exact group the Companions proposed and
 * (b) a group grown one member at a time, always adding someone a current member wanted.
 * Every result still goes through validateParties.
 */
export function composeParties(input: Pick<FormInput, "circle" | "table" | "want" | "verdicts" | "people" | "targetSize" | "exclude" | "priority" | "onlyPriority" | "feasible">): ProposedParty[] {
  const { table, want, verdicts, people, targetSize } = input;
  const members = [...input.circle.members].sort();
  const inCircle = new Set(members);
  const excluded = new Set(input.exclude.map(setKey));
  const priority = (input.priority ?? []).filter((id) => inCircle.has(id)).sort();
  const feasible = input.feasible ?? (() => true);
  const wants = (a: string, b: string) => (want.get(a)?.has(b) ? 1 : 0);
  const ok = (a: string, b: string) => pairAllowed(people.get(a)!, people.get(b)!);
  const links = (g: string[]) => {
    let n = 0;
    for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) n += wants(g[i], g[j]) + wants(g[j], g[i]);
    return n;
  };
  const mean = (g: string[]) => {
    let sum = 0, n = 0;
    for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) { sum += pairScore(verdicts, g[i], g[j]); n++; }
    return n ? sum / n : 0;
  };
  const support = new Map<string, number>();
  for (const row of table) support.set(setKey(row.members), (support.get(setKey(row.members)) ?? 0) + 1 + row.backers.length);
  const weakest = (g: string[]) => {
    let min = 100;
    for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) min = Math.min(min, pairScore(verdicts, g[i], g[j]));
    return min;
  };
  // A squad nobody will sign off on is worth less than any squad everyone can live with.
  const quality = (g: string[]) => (weakest(g) >= SIGN_OFF_FLOOR ? 1_000_000 : 0) + links(g) * 10 + (support.get(setKey(g)) ?? 0) * 5 + mean(g) / 100;
  const valid = (g: string[], used: Set<string>) =>
    g.length === targetSize && g.every((id) => inCircle.has(id) && !used.has(id)) && !excluded.has(setKey(g)) &&
    validateParty(g.map((id) => people.get(id)!)).ok && g.every((id) => chosen(id, g, want)) && feasible(g);

  const grow = (seed: string, used: Set<string>, strict: boolean): string[] | null => {
    const g = [seed];
    while (g.length < targetSize) {
      let best: { id: string; score: number } | null = null;
      for (const c of members) {
        if (used.has(c) || g.includes(c) || !g.every((x) => ok(x, c)) || !g.some((x) => wants(x, c)) || !feasible([...g, c])) continue;
        if (strict && g.some((x) => pairScore(verdicts, x, c) < SIGN_OFF_FLOOR)) continue;
        const score = g.reduce((n, x) => n + wants(x, c) + wants(c, x), 0) * 1000 + g.reduce((n, x) => n + pairScore(verdicts, x, c), 0) / g.length;
        if (!best || score > best.score) best = { id: c, score };
      }
      if (!best) return null;
      g.push(best.id);
    }
    return g.sort();
  };

  const used = new Set<string>();
  const out: ProposedParty[] = [];
  const seeds = [...priority, ...(input.onlyPriority ? [] : members.filter((m) => !priority.includes(m)))];
  for (const seed of seeds) {
    if (used.has(seed)) continue;
    const options = [...table.filter((r) => r.members.includes(seed)).map((r) => [...r.members].sort()), grow(seed, used, true), grow(seed, used, false)]
      .filter((g): g is string[] => Boolean(g) && valid(g as string[], used));
    const best = options.sort((a, b) => quality(b) - quality(a) || setKey(a).localeCompare(setKey(b)))[0];
    if (!best) continue;
    best.forEach((id) => used.add(id));
    out.push({ members: best, why: templateWhy(best, people) });
  }
  return out;
}

const FormOut = z.object({ parties: z.array(z.object({ members: z.array(z.any()).optional(), why: z.any().optional() })).max(8) });

/** Final parties for one circle, from what the Companions proposed and backed. */
export async function formParties(input: FormInput): Promise<{ parties: ProposedParty[]; heldBack: string[]; source: string }> {
  const { circle, table, want, verdicts, people, targetSize, exclude } = input;
  const members = [...circle.members].sort();
  const priority = new Set(input.priority ?? []);
  const keep = (ps: ProposedParty[]) => (input.onlyPriority ? ps.filter((p) => p.members.some((m) => priority.has(m))) : ps);
  const fallback = () => validateParties(keep(composeParties(input)), members, want, people, targetSize, exclude, input.feasible);

  let parties: ProposedParty[] = [];
  let source = "template";
  if (input.useModel) {
    const resolve = makeResolver(members, people);
    const scores: [string, string, number][] = [];
    for (let i = 0; i < members.length; i++) for (let j = i + 1; j < members.length; j++) scores.push([members[i], members[j], pairScore(verdicts, members[i], members[j])]);
    const ai = await runAi({
      task: "orchestrator_form",
      system:
        `You are the Orchestrator inside Facebook Events' Queue Up. Each person's Companion agent has talked to the others, proposed a squad for its person, and backed or amended other proposals. Form the final squads. Rules: every squad has exactly ${targetSize} people; a person is in at most one squad; a person may only be in a squad if another member's Companion proposed or backed a group containing them, or if their own Companion proposed that group; prefer groups the Companions converged on and avoid low pair scores; you may combine people from different proposals when the Companions' choices overlap; if a good squad exists for someone in \"placeFirst\", form that squad first${input.onlyPriority ? ", and only form squads that include at least one of them" : ""}; leave people out rather than force a weak squad; never use a listed excluded group. For each squad write "why": one or two friendly sentences to that squad, citing concrete shared interests, naming nobody outside it. Never mention or infer politics, religion, health or sexuality. Use the ids given. JSON only: {"parties": [{"members": ["<id>", ...], "why": "..."}]}.`,
      user: JSON.stringify({
        squadSize: targetSize,
        attempt: input.attempt,
        circle: circle.theme,
        people: members.map((id) => ({ id, name: first(people.get(id)!), into: openView(input.briefs.get(id)!).facts.slice(0, 5).map((f) => f.text) })),
        proposals: table.map((r) => ({ id: r.id, by: r.by, members: [...r.members].sort(), says: r.line, backedBy: [...r.backers].sort() })),
        pairScores: scores,
        placeFirst: [...priority].filter((id) => members.includes(id)).sort(),
        excluded: exclude.map((e) => [...e].sort()),
      }),
      schema: FormOut,
      fallback: () => ({ parties: [] }),
      maxTokens: 1500,
      temperature: 0.3,
      timeoutMs: 60_000,
    });
    source = ai.source;
    const proposed = ai.value.parties.map((p) => {
      const ids = (p.members ?? []).map(resolve).filter((x): x is string => Boolean(x)).sort();
      const why = typeof p.why === "string" && p.why.trim().length >= 5 && !isSensitiveText(p.why) ? p.why.trim().slice(0, 400) : templateWhy(ids, people);
      return { members: ids, why };
    });
    parties = validateParties(keep(proposed), members, want, people, targetSize, exclude, input.feasible);
    if (!parties.length) source = "fallback";
  }
  if (!parties.length) parties = fallback();
  const used = new Set(parties.flatMap((p) => p.members));
  return { parties, heldBack: members.filter((m) => !used.has(m)), source };
}
