import type { AvailabilityWindow } from "@/lib/profile/builder";
import { commonWindows, longestWindow } from "./availability";
import { compatibility, type CompatInput, type CompatResult } from "./compat";

export interface CohesionResult {
  score: number;
  avgPairwise: number;
  minPairwise: number;
  /** member with the lowest average score to the rest */
  weakestMemberId: string;
  sharedWindows: AvailabilityWindow[];
  bestWindow: AvailabilityWindow | null;
  windowScore: number;
  /** tags liked by ≥ half the group, most common first */
  sharedTags: { tag: string; count: number }[];
}

export const COHESION_WEIGHTS = { avg: 0.5, min: 0.3, window: 0.2 } as const;
/** A shared window this long (minutes) earns full window credit. */
const FULL_WINDOW_MIN = 180;

type Scorer = (a: CompatInput, b: CompatInput) => CompatResult;

/**
 * Cohesion of a candidate group of 2–8. Penalizes outliers via the min pairwise term.
 *
 * `cameTogether` maps a member id to the id of the friends they queued with (queue with friends).
 * Pairs that came together are skipped in the pairwise terms: they picked each other, so their
 * own overlap must never hold their squad back. Every pair across that line still counts, so each
 * newcomer has to fit every friend. Shared tags and time windows still use everyone.
 */
export function groupCohesion(members: CompatInput[], score: Scorer = compatibility, cameTogether?: Map<string, string>): CohesionResult {
  if (members.length < 2) throw new Error("A group needs at least 2 members");
  const together = (a: string, b: string) => {
    const ga = cameTogether?.get(a);
    return ga != null && ga === cameTogether?.get(b);
  };
  const per = new Map<string, number[]>(members.map((m) => [m.id, []]));
  let sum = 0, n = 0, min = 1;
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      if (together(members[i].id, members[j].id)) continue;
      const s = score(members[i], members[j]).score;
      sum += s;
      n++;
      min = Math.min(min, s);
      per.get(members[i].id)!.push(s);
      per.get(members[j].id)!.push(s);
    }
  }
  // Everyone came together (no newcomer): nothing to judge pairwise, so the pair terms are neutral.
  const avg = n ? sum / n : 1;
  const weakest = [...per.entries()]
    .map(([id, xs]) => [id, xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 1] as const)
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))[0][0];

  const sharedWindows = commonWindows(members.map((m) => m.profile.availability));
  const bestWindow = longestWindow(sharedWindows);
  const windowScore = bestWindow ? Math.min(1, (bestWindow.endMin - bestWindow.startMin) / FULL_WINDOW_MIN) : 0;

  const counts = new Map<string, number>();
  for (const m of members) for (const t of m.profile.interestTags) counts.set(t.tag, (counts.get(t.tag) ?? 0) + 1);
  const sharedTags = [...counts.entries()]
    .filter(([, c]) => c >= Math.ceil(members.length / 2))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag, count]) => ({ tag, count }));

  const r3 = (x: number) => Math.round(x * 1000) / 1000;
  return {
    score: r3(COHESION_WEIGHTS.avg * avg + COHESION_WEIGHTS.min * min + COHESION_WEIGHTS.window * windowScore),
    avgPairwise: r3(avg),
    minPairwise: r3(min),
    weakestMemberId: weakest,
    sharedWindows,
    bestWindow,
    windowScore: r3(windowScore),
    sharedTags,
  };
}
