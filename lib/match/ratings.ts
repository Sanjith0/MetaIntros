/**
 * Post-event ratings as matching signals (pure). After a squad chat ends, each member can rate the
 * night (1–5 stars) and say, per squadmate, whether they'd squad up with them again.
 *
 * - Stars teach a per-person tag affinity: events with the tags of nights you loved rank higher in
 *   "For you" and in the Event Selection Agent's options; tags of nights you didn't enjoy rank lower.
 * - "Again" lifts that pair's compatibility, more when it's mutual.
 * - "Not again" keeps the pair apart in future squads (like a quiet block, but it's never shown and
 *   never applied between people who chose to queue together).
 *
 * Privacy: these are anonymous signals. Nothing here returns who rated whom to anyone but the rater.
 */
import type { CompatInput, CompatResult } from "./compat";

export type MateVerdict = "again" | "not_again";
export const MATE_VERDICTS: readonly MateVerdict[] = ["again", "not_again"] as const;

export interface StarRating {
  stars: number;
  tags: string[];
}
export interface MateEdge {
  raterId: string;
  rateeId: string;
  verdict: MateVerdict;
}

/** Tag affinity per point of stars away from 3: 5★ → +0.5 per tag, 1★ → −0.5. */
const AFFINITY_PER_RATING = 0.5;
const AFFINITY_CAP = 1;

/** Learned tag → affinity in [−1, 1] from someone's star ratings. Empty map when they never rated. */
export function tagAffinity(ratings: StarRating[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of ratings) {
    if (!Number.isFinite(r.stars) || r.stars < 1 || r.stars > 5) continue;
    const w = ((r.stars - 3) / 2) * AFFINITY_PER_RATING;
    if (w === 0) continue;
    for (const t of new Set(r.tags)) out.set(t, (out.get(t) ?? 0) + w);
  }
  for (const [t, v] of out) out.set(t, Math.max(-AFFINITY_CAP, Math.min(AFFINITY_CAP, Math.round(v * 1000) / 1000)));
  return out;
}

/** Sum of a person's affinity over an event's tags (0 when they've never rated anything like it). */
export function eventAffinity(tags: string[], affinity: Map<string, number>): number {
  let s = 0;
  for (const t of new Set(tags)) s += affinity.get(t) ?? 0;
  return Math.round(s * 1000) / 1000;
}

/** How much your post-event ratings move "For you" (per point of tag affinity), and when the card says so. */
export const RATED_FEED_WEIGHT = 1.5;
export const RATED_FEED_LABEL_MIN = 0.4;

/** Compatibility lift for a pair: both said "again" → +0.15, one did → +0.08. */
export const AGAIN_MUTUAL_BONUS = 0.15;
export const AGAIN_ONE_WAY_BONUS = 0.08;

const pk = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export interface PairSignals {
  /** pair key → number of "again" votes between them (0, 1 or 2) */
  again: Map<string, number>;
  /** pairs where either person said "not again" */
  avoid: Set<string>;
}

/**
 * Collapse every rating edge into pair signals. Later ratings of the same pair (from a later squad)
 * win per direction, so someone can change their mind after a second night out.
 */
export function pairSignals(edges: MateEdge[]): PairSignals {
  const latest = new Map<string, MateVerdict>(); // "rater>ratee" → verdict (edges arrive oldest first)
  for (const e of edges) if (e.raterId !== e.rateeId) latest.set(`${e.raterId}>${e.rateeId}`, e.verdict);
  const again = new Map<string, number>();
  const avoid = new Set<string>();
  for (const [k, v] of latest) {
    const [a, b] = k.split(">");
    if (v === "not_again") avoid.add(pk(a, b));
    else again.set(pk(a, b), (again.get(pk(a, b)) ?? 0) + 1);
  }
  for (const k of avoid) again.delete(k); // one "not again" outweighs any "again"
  return { again, avoid };
}

export function pairBonus(s: PairSignals, a: string, b: string): number {
  const n = s.again.get(pk(a, b)) ?? 0;
  return n >= 2 ? AGAIN_MUTUAL_BONUS : n === 1 ? AGAIN_ONE_WAY_BONUS : 0;
}

export function pairAvoided(s: PairSignals, a: string, b: string): boolean {
  return s.avoid.has(pk(a, b));
}

/** Wrap a pair scorer so "again" votes lift a pair's score (capped at 1). Keeps the breakdown. */
export function ratingAwareScorer<P extends CompatInput>(score: (a: P, b: P) => CompatResult, s: PairSignals): (a: P, b: P) => CompatResult {
  if (!s.again.size) return score;
  return (a, b) => {
    const r = score(a, b);
    const bonus = pairBonus(s, a.id, b.id);
    return bonus ? { ...r, score: Math.min(1, Math.round((r.score + bonus) * 1000) / 1000) } : r;
  };
}

/**
 * Apply "not again" as a matching-only block on in-memory people (never written to the Block table,
 * never shown). Pairs that share a queue-together group are exempt: they chose each other this time.
 */
export function applyAvoids(people: Map<string, { id: string; blocked: Set<string> }>, s: PairSignals, sameGroup: (a: string, b: string) => boolean = () => false) {
  if (!s.avoid.size) return 0;
  let n = 0;
  for (const k of s.avoid) {
    const [a, b] = k.split("|");
    const pa = people.get(a), pb = people.get(b);
    if (!pa || !pb || sameGroup(a, b)) continue;
    pa.blocked.add(b);
    pb.blocked.add(a);
    n++;
  }
  return n;
}

/** How many pairs inside a group have an "again" vote (for the agent prompt and trace, no names). */
export function againPairsIn(userIds: string[], s: PairSignals): number {
  let n = 0;
  for (let i = 0; i < userIds.length; i++) for (let j = i + 1; j < userIds.length; j++) if (pairBonus(s, userIds[i], userIds[j]) > 0) n++;
  return n;
}
