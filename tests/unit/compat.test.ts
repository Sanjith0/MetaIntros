import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { compatibility } from "@/lib/match/compat";
import { commonWindows, overlapMinutes, coversRange } from "@/lib/match/availability";
import { loadPeopleFromFiles } from "../helpers/people";
import { MockGraphSource } from "@/lib/graph/source";

const people = loadPeopleFromFiles();
const P = (id: string) => people.get(id)!;
const cluster = new Map(new MockGraphSource().listUserIds().map((id) => [id, new MockGraphSource().getUser(id).x_cluster]));
const ids = [...people.keys()];

describe("pairwise compatibility", () => {
  it("known-compatible pairs outscore known-incompatible pairs", () => {
    const meIndie = compatibility(P("p01"), P("p02")).score;
    const meOutlier = compatibility(P("p01"), P("p73")).score;
    const meFood = compatibility(P("p01"), P("p66")).score;
    expect(meIndie).toBeGreaterThan(meFood);
    expect(meFood).toBeGreaterThan(meOutlier);
  });

  it("same-cluster pairs average much higher than cross-cluster pairs", () => {
    let inS = 0, inN = 0, outS = 0, outN = 0;
    for (const a of ids) for (const b of ids) {
      if (a >= b) continue;
      const s = compatibility(P(a), P(b)).score;
      if (cluster.get(a) === cluster.get(b) && cluster.get(a) !== "bridge") { inS += s; inN++; } else { outS += s; outN++; }
    }
    expect(inS / inN).toBeGreaterThan(outS / outN + 0.2);
  });

  it("dislike conflicts lower the score and are explained in the breakdown", () => {
    const base = P("p02");
    const r1 = compatibility(P("p01"), base);
    const hater = structuredClone({ ...base, friends: base.friends, blocked: base.blocked });
    hater.profile = {
      ...hater.profile,
      dislikes: [...hater.profile.dislikes, { name: "Pitchfork", tag: "indie-music", category: "Musician/Band", source: "x_not_interested[9]" }],
    };
    const r2 = compatibility(P("p01"), hater);
    expect(r2.score).toBeLessThan(r1.score);
    expect(r2.breakdown.dislikeConflicts).toContainEqual({ tag: "indie-music", dislikedBy: "p02" });
    expect(compatibility(P("p01"), P("p73")).breakdown.dislikeConflicts.length).toBeGreaterThan(0);
  });

  it("is symmetric (property test over all persona pairs)", () => {
    fc.assert(
      fc.property(fc.constantFrom(...ids), fc.constantFrom(...ids), (a, b) => {
        fc.pre(a !== b);
        expect(compatibility(P(a), P(b))).toEqual(compatibility(P(b), P(a)));
      }),
      { numRuns: 300 },
    );
  });

  it("scores are bounded in [0,1] and include a full breakdown", () => {
    const r = compatibility(P("p01"), P("p05"));
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(1);
    expect(Object.keys(r.breakdown).sort()).toEqual(
      ["availability", "dislikeConflicts", "dislikePenalty", "embedding", "mutualBonus", "mutualFriends", "overlapMinutes", "sharedInterests", "sharedTags"],
    );
    expect(r.breakdown.sharedTags.length).toBeGreaterThanOrEqual(2);
  });

  it("mutual friends add a bonus", () => {
    const a = P("p05"), b = P("p06");
    const lonely = { ...b, friends: new Set<string>() };
    expect(compatibility(a, b).breakdown.mutualFriends.length).toBeGreaterThan(0);
    expect(compatibility(a, b).score).toBeGreaterThan(compatibility(a, lonely).score);
  });
});

describe("availability math", () => {
  const w = (d: number, s: number, e: number) => ({ dayOfWeek: d, startMin: s, endMin: e });
  it("intersects windows across many people", () => {
    expect(commonWindows([[w(6, 600, 1200)], [w(6, 700, 1300)], [w(6, 650, 1000), w(0, 0, 100)]])).toEqual([w(6, 700, 1000)]);
    expect(overlapMinutes([w(5, 0, 60)], [w(6, 0, 60)])).toBe(0);
  });
  it("checks if an event fits a window", () => {
    const sat = (h: number, m = 0) => new Date(2026, 10, 14, h, m);
    expect(coversRange([w(6, 600, 1440)], sat(19, 30), sat(22, 30))).toBe(true);
    expect(coversRange([w(6, 600, 1200)], sat(19, 30), sat(22, 30))).toBe(false);
  });
});
