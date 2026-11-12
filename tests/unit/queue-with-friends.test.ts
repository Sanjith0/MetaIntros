import { describe, expect, it } from "vitest";
import LANDMARKS from "@/data/seed/landmarks.json";
import { findProposal, playersFound, runTick, unitsOf, type EngineOptions, type QueueItem } from "@/lib/match/engine";
import { groupCohesion } from "@/lib/match/cohesion";
import { makePairScorer } from "@/lib/match/compat";
import { validateParty } from "@/lib/match/safety";
import { loadPeopleFromFiles } from "../helpers/people";

const people = loadPeopleFromFiles();
const landmarks = new Map(LANDMARKS.map((l) => [l.id, l]));
const score = makePairScorer();
const opts: EngineOptions = { now: 60_000, fillMode: "simulated", liveFloor: true };
const item = (userId: string, over: Partial<QueueItem> = {}): QueueItem => ({
  entryId: `e-${userId}`, userId, targetSize: 6, bucketId: "lm-downtown-pa", eventId: null, joinedAt: 0, isSimulated: true, ...over,
});
const band = (b: string) => [...people.values()].filter((p) => p.ageBand === b && !p.womenOnlyParty && p.blocked.size === 0).map((p) => p.id);
const adults18 = band("18-24");

/** p01 (Jordan) with friends p02 and p04, all 18–24. */
const friends = ["p01", "p02", "p04"].map((u) => item(u, { groupId: "g1", isSimulated: u !== "p01" }));
const strangers = adults18.filter((id) => !["p01", "p02", "p04"].includes(id)).map((u) => item(u, { joinedAt: 1000 }));

describe("queue with friends (engine)", () => {
  it("unitsOf keeps friends together and everyone else alone", () => {
    const units = unitsOf([...friends, ...strangers.slice(0, 3)]);
    expect(units).toHaveLength(4);
    expect(units[0].map((u) => u.userId)).toEqual(["p01", "p02", "p04"]);
  });

  it("a squad always holds the whole group and fills only the open slots", () => {
    const res = runTick([...friends, ...strangers], people, landmarks, opts, undefined, score);
    const mine = res.find((r) => r.chosen.userIds.includes("p01"))!;
    expect(mine).toBeTruthy();
    expect(mine.chosen.userIds).toHaveLength(6);
    for (const f of ["p01", "p02", "p04"]) expect(mine.chosen.userIds).toContain(f);
    // no other squad got any of the friends
    for (const r of res.filter((x) => x !== mine)) for (const f of ["p01", "p02", "p04"]) expect(r.chosen.userIds).not.toContain(f);
  });

  it("a group is never split, even when only some of it would fit", () => {
    // another group of 3 plus 2 solos for a squad of 4: the group of 3 can't join a squad that already has 2
    const g2 = strangers.slice(0, 3).map((s) => ({ ...s, groupId: "g2", targetSize: 4 }));
    const solos = strangers.slice(3, 8).map((s) => ({ ...s, targetSize: 4 }));
    const res = runTick([...solos.slice(0, 2), ...g2, ...solos.slice(2)], people, landmarks, opts, undefined, score);
    expect(res.length).toBeGreaterThan(0);
    for (const r of res) {
      const hasAny = g2.some((g) => r.chosen.userIds.includes(g.userId));
      const hasAll = g2.every((g) => r.chosen.userIds.includes(g.userId));
      expect(hasAny).toBe(hasAll);
    }
  });

  it("two groups can share one squad", () => {
    const g2 = strangers.slice(0, 2).map((s) => ({ ...s, groupId: "g2" }));
    const res = runTick([...friends, ...g2, ...strangers.slice(2, 3)], people, landmarks, opts, undefined, score);
    expect(res).toHaveLength(1);
    expect(res[0].chosen.userIds).toHaveLength(6);
  });

  it("a group that fills the whole squad is never matched (it needs a newcomer)", () => {
    const six = strangers.slice(0, 6).map((s) => ({ ...s, groupId: "g6" }));
    expect(runTick([...six, ...strangers.slice(6)], people, landmarks, opts, undefined, score).some((r) => r.chosen.userIds.includes(six[0].userId))).toBe(false);
  });

  it("a block between a friend and a stranger keeps the stranger out", () => {
    // p09 blocked p01
    const p09 = item("p09", { joinedAt: 500 });
    const res = runTick([...friends, p09, ...strangers], people, landmarks, opts, undefined, score);
    const mine = res.find((r) => r.chosen.userIds.includes("p01"))!;
    expect(mine.chosen.userIds).not.toContain("p09");
  });

  it("newcomers come from the friends' age band only", () => {
    const older = band("25+").map((u) => item(u));
    const res = runTick([...friends, ...older, ...strangers.slice(0, 3)], people, landmarks, opts, undefined, score);
    const mine = res.find((r) => r.chosen.userIds.includes("p01"))!;
    expect(validateParty(mine.chosen.userIds.map((u) => people.get(u)!)).ok).toBe(true);
    for (const u of mine.chosen.userIds) expect(people.get(u)!.ageBand).toBe("18-24");
  });

  it("friends' own overlap never counts against their squad", () => {
    const members = ["p01", "p02", "p04", ...strangers.slice(0, 3).map((s) => s.userId)].map((u) => people.get(u)!);
    const together = new Map([["p01", "g1"], ["p02", "g1"], ["p04", "g1"]]);
    const all = groupCohesion(members, score);
    const skip = groupCohesion(members, score, together);
    // the skipped pairs are exactly the 3 friend pairs; the min only covers pairs with a newcomer
    let minCross = 1;
    for (const a of members) for (const b of members) if (a.id < b.id && !(together.get(a.id) && together.get(b.id))) minCross = Math.min(minCross, score(a, b).score);
    expect(skip.minPairwise).toBeCloseTo(minCross, 2);
    expect(all.sharedTags).toEqual(skip.sharedTags);
  });

  it("the proposal for any member of a group starts from the whole group", () => {
    const p = findProposal(friends[1], [...friends, ...strangers], people, landmarks, opts, score)!;
    expect(p).toBeTruthy();
    for (const c of p.candidates) for (const f of ["p01", "p02", "p04"]) expect(c.userIds).toContain(f);
  });

  it("players found counts the friends straight away", () => {
    expect(playersFound(friends[0], friends, people, landmarks, opts, score).found).toBe(3);
    expect(playersFound(friends[0], [...friends, ...strangers], people, landmarks, opts, score).found).toBe(6);
  });
});
