import { describe, expect, it } from "vitest";
import { groupCohesion } from "@/lib/match/cohesion";
import { loadPeopleFromFiles } from "../helpers/people";

const people = loadPeopleFromFiles();
const G = (...ids: string[]) => ids.map((id) => people.get(id)!);

describe("group cohesion", () => {
  const cohesive6 = ["p01", "p03", "p05", "p11", "p12", "p14"];

  it("a group with one outlier scores worse than a cohesive group", () => {
    const good = groupCohesion(G(...cohesive6));
    const withOutlier = groupCohesion(G(...cohesive6.slice(0, 5), "p73"));
    expect(good.score).toBeGreaterThan(withOutlier.score + 0.1);
    expect(withOutlier.weakestMemberId).toBe("p73");
    expect(withOutlier.minPairwise).toBeLessThan(good.minPairwise);
  });

  it("works for every party size from 2 to 8", () => {
    const pool = ["p01", "p03", "p05", "p11", "p12", "p14", "p04", "p15"];
    for (let n = 2; n <= 8; n++) {
      const good = groupCohesion(G(...pool.slice(0, n)));
      const bad = groupCohesion(G(...pool.slice(0, n - 1), "p74"));
      expect(good.score, `size ${n}`).toBeGreaterThan(bad.score);
    }
    expect(() => groupCohesion(G("p01"))).toThrow();
  });

  it("the min-pairwise term means one bad pair hurts even when the average is fine", () => {
    const base = groupCohesion(G(...cohesive6));
    expect(base.score).toBeLessThanOrEqual(0.5 * base.avgPairwise + 0.3 * base.minPairwise + 0.2 + 1e-9);
  });

  it("finds the shared availability window", () => {
    const r = groupCohesion(G(...cohesive6));
    expect(r.bestWindow).not.toBeNull();
    expect(r.windowScore).toBeGreaterThan(0);
    // run-coffee mornings vs indie evenings → nothing shared on Friday night
    const mixed = groupCohesion(G("p01", "p28", "p29"));
    expect(mixed.sharedWindows.every((w) => w.dayOfWeek !== 5)).toBe(true);
  });

  it("surfaces the group's shared interests", () => {
    const tags = groupCohesion(G(...cohesive6)).sharedTags.map((t) => t.tag);
    expect(tags).toEqual(expect.arrayContaining(["climbing", "indie-music"]));
  });

  it("is order-independent", () => {
    const a = groupCohesion(G(...cohesive6));
    const b = groupCohesion(G(...[...cohesive6].reverse()));
    expect(a.score).toBe(b.score);
    expect(a.sharedWindows).toEqual(b.sharedWindows);
  });
});
