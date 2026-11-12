import type { Bridge, Profile, QueueEntry } from "@/contracts";
import { bridgesBetween } from "@/lib/graph";

/**
 * Party formation, in code. No model is involved.
 *
 * A party is exactly five people who:
 *  - share a landmark bucket,
 *  - share a time window of at least MIN_OVERLAP_MIN minutes,
 *  - are all 18 or older,
 *  - have no block between any two of them,
 *  - respect women-only and not-the-only-woman settings,
 *  - each share a bridge (a mutual friend, or a Group under 200 members)
 *    with at least one other member.
 */

export const PARTY_SIZE = 5;
export const MIN_OVERLAP_MIN = 90;
export const MIN_AGE = 18;

export type RuleId = "size" | "bucket" | "window" | "age" | "blocks" | "women_only" | "not_only_woman" | "bridge";

export interface Violation {
  rule: RuleId;
  userIds: string[];
  detail: string;
}

export interface Candidate {
  entry: QueueEntry;
  profile: Profile;
}

export const bucketKey = (e: QueueEntry) => e.landmark.trim().toLowerCase();

export function overlapMinutes(entries: QueueEntry[]): number {
  if (entries.length === 0) return 0;
  const start = Math.max(...entries.map((e) => Date.parse(e.window.start)));
  const end = Math.min(...entries.map((e) => Date.parse(e.window.end)));
  return Math.max(0, Math.round((end - start) / 60_000));
}

/** Can this person join the queue at all? (18+ is checked at the door of the queue too.) */
export function eligibleToQueue(p: Profile): Violation | null {
  return p.age < MIN_AGE ? { rule: "age", userIds: [p.id], detail: "Party Queue is for people 18 and over." } : null;
}

export function partyBridges(members: Profile[], nameOf: (id: string) => string): Bridge[] {
  const out: Bridge[] = [];
  for (let i = 0; i < members.length; i++)
    for (let j = i + 1; j < members.length; j++) out.push(...bridgesBetween(members[i]!, members[j]!, nameOf));
  return out;
}

/** Every rule a set of candidates breaks. Empty means it is a valid party. */
export function checkParty(cands: Candidate[], nameOf: (id: string) => string = (id) => id): Violation[] {
  const v: Violation[] = [];
  const ids = cands.map((c) => c.profile.id);
  const people = cands.map((c) => c.profile);

  if (cands.length !== PARTY_SIZE) v.push({ rule: "size", userIds: ids, detail: `A party is exactly ${PARTY_SIZE} people, not ${cands.length}.` });

  const buckets = new Set(cands.map((c) => bucketKey(c.entry)));
  if (buckets.size > 1) v.push({ rule: "bucket", userIds: ids, detail: `Members are in ${buckets.size} different landmark buckets.` });

  const overlap = overlapMinutes(cands.map((c) => c.entry));
  if (overlap < MIN_OVERLAP_MIN) v.push({ rule: "window", userIds: ids, detail: `Shared time window is ${overlap} min; at least ${MIN_OVERLAP_MIN} needed.` });

  const minors = people.filter((p) => p.age < MIN_AGE);
  if (minors.length) v.push({ rule: "age", userIds: minors.map((p) => p.id), detail: "Everyone must be 18 or older." });

  for (const a of people)
    for (const b of people)
      if (a.id !== b.id && a.blocks.includes(b.id)) v.push({ rule: "blocks", userIds: [a.id, b.id], detail: `${a.id} has blocked ${b.id}.` });

  const women = people.filter((p) => p.gender === "woman");
  for (const p of people) {
    if (p.settings.womenOnly && women.length !== people.length)
      v.push({ rule: "women_only", userIds: [p.id], detail: "This member only joins all-women parties." });
    if (p.settings.notOnlyWoman && p.gender === "woman" && women.length < 2)
      v.push({ rule: "not_only_woman", userIds: [p.id], detail: "This member is never the only woman in a party." });
  }

  const bridges = partyBridges(people, nameOf);
  for (const p of people) {
    if (!bridges.some((b) => b.a === p.id || b.b === p.id))
      v.push({ rule: "bridge", userIds: [p.id], detail: "No mutual friend or small Group shared with anyone else in the party." });
  }
  return v;
}

function* combinations<T>(xs: T[], k: number, start = 0, acc: T[] = []): Generator<T[]> {
  if (acc.length === k) {
    yield acc;
    return;
  }
  for (let i = start; i <= xs.length - (k - acc.length); i++) yield* combinations(xs, k, i + 1, [...acc, xs[i]!]);
}

export interface Formed {
  members: Candidate[];
  bridges: Bridge[];
}

/**
 * Find the first valid party in a bucket, preferring people who have
 * waited longest. When `mustInclude` is given (the person who just
 * joined), only parties containing them are considered.
 */
export function formParty(cands: Candidate[], opts: { mustInclude?: string; nameOf?: (id: string) => string } = {}): Formed | null {
  const nameOf = opts.nameOf ?? ((id: string) => id);
  const waiting = cands
    .filter((c) => c.entry.status === "waiting" && c.profile.age >= MIN_AGE)
    .sort((a, b) => a.entry.joinedAt.localeCompare(b.entry.joinedAt));
  const byBucket = new Map<string, Candidate[]>();
  for (const c of waiting) {
    const k = bucketKey(c.entry);
    if (!byBucket.has(k)) byBucket.set(k, []);
    byBucket.get(k)!.push(c);
  }
  for (const bucket of byBucket.values()) {
    if (bucket.length < PARTY_SIZE) continue;
    if (opts.mustInclude && !bucket.some((c) => c.profile.id === opts.mustInclude)) continue;
    let tried = 0;
    for (const combo of combinations(bucket, PARTY_SIZE)) {
      if (++tried > 50_000) break; // hard ceiling; buckets are small in practice
      if (opts.mustInclude && !combo.some((c) => c.profile.id === opts.mustInclude)) continue;
      if (checkParty(combo, nameOf).length === 0) {
        return { members: combo, bridges: partyBridges(combo.map((c) => c.profile), nameOf) };
      }
    }
  }
  return null;
}
