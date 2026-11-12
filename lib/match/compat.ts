import { cosine } from "@/lib/profile/embedding";
import { dislikeTags, type TasteProfileData } from "@/lib/profile/builder";
import { overlapMinutes, totalMinutes } from "./availability";

export interface CompatInput {
  id: string;
  profile: TasteProfileData;
  friends: Set<string>;
}

export interface CompatBreakdown {
  embedding: number;
  sharedInterests: number;
  sharedTags: string[];
  dislikeConflicts: { tag: string; dislikedBy: string }[];
  dislikePenalty: number;
  availability: number;
  overlapMinutes: number;
  mutualFriends: string[];
  mutualBonus: number;
}

export interface CompatResult {
  score: number;
  breakdown: CompatBreakdown;
}

export const COMPAT_WEIGHTS = { embedding: 0.3, shared: 0.3, availability: 0.25, mutual: 0.15 } as const;
const PENALTY_PER_CONFLICT = 0.12;
const PENALTY_CAP = 0.45;

const round = (x: number) => Math.round(x * 1000) / 1000;

/** Pairwise compatibility in [0, 1]. Symmetric by construction. */
export function compatibility(a: CompatInput, b: CompatInput): CompatResult {
  const emb = Math.max(0, cosine(a.profile.embedding, b.profile.embedding));

  const wa = new Map(a.profile.interestTags.map((t) => [t.tag, t.weight]));
  const wb = new Map(b.profile.interestTags.map((t) => [t.tag, t.weight]));
  let minSum = 0, maxSum = 0;
  const sharedTags: string[] = [];
  for (const tag of new Set([...wa.keys(), ...wb.keys()])) {
    const x = wa.get(tag) ?? 0, y = wb.get(tag) ?? 0;
    minSum += Math.min(x, y);
    maxSum += Math.max(x, y);
    if (x > 0 && y > 0) sharedTags.push(tag);
  }
  // weighted Jaccard, boosted so 3+ shared specific interests reads as strong overlap
  const jac = maxSum === 0 ? 0 : minSum / maxSum;
  const shared = Math.min(1, jac * 1.6 + Math.min(sharedTags.length, 4) * 0.05);

  const conflicts: CompatBreakdown["dislikeConflicts"] = [];
  for (const t of dislikeTags(a.profile)) if (wb.has(t)) conflicts.push({ tag: t, dislikedBy: a.id });
  for (const t of dislikeTags(b.profile)) if (wa.has(t)) conflicts.push({ tag: t, dislikedBy: b.id });
  conflicts.sort((x, y) => x.tag.localeCompare(y.tag) || x.dislikedBy.localeCompare(y.dislikedBy));
  const penalty = Math.min(PENALTY_CAP, conflicts.length * PENALTY_PER_CONFLICT);

  const overlap = overlapMinutes(a.profile.availability, b.profile.availability);
  const denom = Math.min(totalMinutes(a.profile.availability), totalMinutes(b.profile.availability));
  const avail = denom === 0 ? 0 : Math.min(1, overlap / Math.min(denom, 8 * 60));

  const mutual = [...a.friends].filter((f) => b.friends.has(f) && f !== a.id && f !== b.id).sort();
  const mutualBonus = Math.min(mutual.length, 4) / 4;

  const raw =
    COMPAT_WEIGHTS.embedding * emb +
    COMPAT_WEIGHTS.shared * shared +
    COMPAT_WEIGHTS.availability * avail +
    COMPAT_WEIGHTS.mutual * mutualBonus -
    penalty;

  return {
    score: round(Math.max(0, Math.min(1, raw))),
    breakdown: {
      embedding: round(emb),
      sharedInterests: round(shared),
      sharedTags: sharedTags.sort(),
      dislikeConflicts: conflicts,
      dislikePenalty: round(penalty),
      availability: round(avail),
      overlapMinutes: overlap,
      mutualFriends: mutual,
      mutualBonus: round(mutualBonus),
    },
  };
}

/** Memoizing pairwise scorer for the queue engine. */
export function makePairScorer() {
  const cache = new Map<string, CompatResult>();
  return (a: CompatInput, b: CompatInput) => {
    const key = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;
    let r = cache.get(key);
    if (!r) {
      r = a.id < b.id ? compatibility(a, b) : compatibility(b, a);
      cache.set(key, r);
    }
    return r;
  };
}
