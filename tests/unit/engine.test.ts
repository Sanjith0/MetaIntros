import { describe, expect, it } from "vitest";
import LANDMARKS from "@/data/seed/landmarks.json";
import { findProposal, LEVELS, LIVE_FLOOR_LEVEL, runTick, type EngineOptions, type QueueItem } from "@/lib/match/engine";
import { makePairScorer } from "@/lib/match/compat";
import { validateParty } from "@/lib/match/safety";
import { nearestLandmark } from "@/lib/geo";
import { mulberry32, sample } from "@/lib/rng";
import { clusterOf, loadPeopleFromFiles } from "../helpers/people";

const people = loadPeopleFromFiles();
const landmarks = new Map(LANDMARKS.map((l) => [l.id, l]));
const bucketOf = (id: string) => nearestLandmark({ lat: people.get(id)!.homeLat!, lng: people.get(id)!.homeLng! }, LANDMARKS).landmark.id;
const item = (userId: string, joinedAt: number, over: Partial<QueueItem> = {}): QueueItem => ({
  entryId: `e-${userId}-${joinedAt}`, userId, targetSize: 6, bucketId: "lm-downtown-pa", eventId: null, joinedAt, isSimulated: true, ...over,
});

/** Drive the engine with arrivals + ticks every 2s; returns formed parties with timings. */
function simulate(arrivals: QueueItem[], opts: Omit<EngineOptions, "now">, endMs: number) {
  const waiting: QueueItem[] = [];
  const parties: { userIds: string[]; entryIds: string[]; at: number; size: number; level: number }[] = [];
  const score = makePairScorer();
  const pending = [...arrivals].sort((a, b) => a.joinedAt - b.joinedAt);
  for (let t = 0; t <= endMs; t += 2000) {
    while (pending.length && pending[0].joinedAt <= t) waiting.push(pending.shift()!);
    const res = runTick(waiting, people, landmarks, { ...opts, now: t }, undefined, score);
    for (const { proposal, chosen } of res) {
      parties.push({ userIds: chosen.userIds, entryIds: chosen.entryIds, at: t, size: proposal.targetSize, level: proposal.level });
      for (const id of chosen.entryIds) waiting.splice(waiting.findIndex((w) => w.entryId === id), 1);
    }
  }
  return { parties, leftovers: waiting };
}

describe("queue engine", () => {
  it("50 users joining over time: parties form, nobody double-booked, sizes exact, waits bounded", () => {
    const rng = mulberry32(7);
    const ids = sample(rng, [...people.keys()], 50);
    const arrivals = ids.map((id) =>
      item(id, Math.floor(rng() * 60_000), { targetSize: rng() < 0.5 ? 4 : 6, bucketId: bucketOf(id) }),
    );
    const byEntry = new Map(arrivals.map((a) => [a.entryId, a]));
    const END = 200_000;
    const { parties, leftovers } = simulate(arrivals, { fillMode: "simulated", liveFloor: true }, END);

    expect(parties.length).toBeGreaterThanOrEqual(6);
    const seen = new Set<string>();
    for (const p of parties) {
      expect(p.userIds).toHaveLength(p.size);
      for (const e of p.entryIds) expect(byEntry.get(e)!.targetSize).toBe(p.size);
      for (const u of p.userIds) {
        expect(seen.has(u), `${u} in two parties`).toBe(false);
        seen.add(u);
      }
      expect(validateParty(p.userIds.map((u) => people.get(u)!)).ok).toBe(true);
    }
    // Bounded wait: everyone matched within (last arrival + floor level + one tick)
    const bound = 60_000 + LIVE_FLOOR_LEVEL.afterMs + 4_000;
    for (const p of parties) for (const e of p.entryIds) expect(p.at - byEntry.get(e)!.joinedAt).toBeLessThanOrEqual(bound);
    // …and whoever is left genuinely has no safe group available even at the cap.
    const score = makePairScorer();
    for (const l of leftovers) {
      expect(findProposal(l, leftovers, people, landmarks, { now: END + 1e9, fillMode: "simulated", liveFloor: true }, score)).toBeNull();
    }
    expect(leftovers.length + seen.size).toBe(50);
  });

  it("starts strict: a cohesive cluster matches instantly, a random mix only after widening", () => {
    const cohesive = ["p01", "p03", "p05", "p11", "p12", "p14"].map((id) => item(id, 0));
    const now0 = runTick(cohesive, people, landmarks, { now: 0, fillMode: "simulated" });
    expect(now0).toHaveLength(1);
    expect(now0[0].proposal.level).toBe(0);
    expect(now0[0].chosen.cohesion.score).toBeGreaterThanOrEqual(LEVELS[0].minCohesion);

    // one 18-24 person from each cluster (same band so safety allows it)
    const src = [...people.values()].filter((p) => p.ageBand === "18-24" && p.id !== "p09");
    const byCluster = new Map<string, string>();
    for (const p of src) {
      const c = clusterOf(p.id)!;
      if (!byCluster.has(c) && !p.womenOnlyParty) byCluster.set(c, p.id);
    }
    const random = [...byCluster.values()].slice(0, 6).map((id) => item(id, 0));
    expect(random).toHaveLength(6);
    expect(runTick(random, people, landmarks, { now: 0, fillMode: "simulated" })).toHaveLength(0);
    const late = runTick(random, people, landmarks, { now: 60_000, fillMode: "simulated", liveFloor: true });
    expect(late).toHaveLength(1);
    expect(late[0].proposal.level).toBe(LEVELS.length); // floor level
  });

  it("widens distance with wait time (different buckets join only later)", () => {
    const g = ["p01", "p03", "p05", "p11"].map((id, i) => item(id, 0, { targetSize: 4, bucketId: i < 2 ? "lm-downtown-pa" : "lm-cal-ave" }));
    expect(runTick(g, people, landmarks, { now: 0, fillMode: "simulated" })).toHaveLength(0);
    expect(runTick(g, people, landmarks, { now: 20_000, fillMode: "simulated" })).toHaveLength(1);
  });

  it("never mixes party sizes", () => {
    const q = [
      ...["p01", "p03", "p05"].map((id) => item(id, 0, { targetSize: 3 })),
      ...["p11", "p12", "p14", "p04"].map((id) => item(id, 0, { targetSize: 4 })),
    ];
    const r = runTick(q, people, landmarks, { now: 0, fillMode: "simulated" });
    expect(r.map((x) => x.chosen.userIds.length).sort()).toEqual([3, 4]);
    for (const x of r) expect(new Set(x.chosen.entryIds.map((e) => q.find((i) => i.entryId === e)!.targetSize)).size).toBe(1);
  });

  it("supports every party size from 2 to 8", () => {
    const pool = ["p01", "p03", "p05", "p11", "p12", "p14", "p04", "p15"];
    for (let n = 2; n <= 8; n++) {
      const r = runTick(pool.slice(0, n).map((id) => item(id, 0, { targetSize: n })), people, landmarks, { now: 60_000, fillMode: "simulated", liveFloor: true });
      expect(r, `size ${n}`).toHaveLength(1);
      expect(r[0].chosen.userIds).toHaveLength(n);
    }
  });

  it("never mixes two different specific events; 'anything' can join either", () => {
    const q = [
      item("p01", 0, { targetSize: 3, eventId: "ev-a" }),
      item("p03", 0, { targetSize: 3, eventId: "ev-b" }),
      item("p05", 0, { targetSize: 3, eventId: null }),
    ];
    expect(runTick(q, people, landmarks, { now: 60_000, fillMode: "simulated", liveFloor: true })).toHaveLength(0);
    q.push(item("p11", 0, { targetSize: 3, eventId: "ev-a" }));
    const r = runTick(q, people, landmarks, { now: 60_000, fillMode: "simulated", liveFloor: true });
    expect(r).toHaveLength(1);
    expect(r[0].chosen.eventId).toBe("ev-a");
    expect(r[0].chosen.userIds).not.toContain("p03");
  });

  it("live mode: simulated users never fill; mixed mode: only after the delay", () => {
    const real = item("p01", 0, { targetSize: 3, isSimulated: false });
    const real2 = item("p11", 0, { targetSize: 3, isSimulated: false, entryId: "real2" });
    const sims = ["p03", "p05"].map((id) => item(id, 0, { targetSize: 3 }));
    expect(runTick([real, ...sims], people, landmarks, { now: 60_000, fillMode: "live" })).toHaveLength(0);
    expect(runTick([real, real2, ...sims.slice(0, 1)], people, landmarks, { now: 60_000, fillMode: "live" })).toHaveLength(0);
    const twoRealPlusOne = [real, real2, item("live-3", 0, { targetSize: 3, isSimulated: false, userId: "p05" })];
    expect(runTick(twoRealPlusOne, people, landmarks, { now: 0, fillMode: "live" })).toHaveLength(1);

    expect(runTick([real, ...sims], people, landmarks, { now: 5_000, fillMode: "mixed", mixedFillDelayMs: 12_000 })).toHaveLength(0);
    expect(runTick([real, ...sims], people, landmarks, { now: 13_000, fillMode: "mixed", mixedFillDelayMs: 12_000 })).toHaveLength(1);
  });

  it("an agent choice outside the candidate list is ignored (falls back to the engine's best)", () => {
    const q = ["p01", "p03", "p05", "p11", "p12", "p14"].map((id) => item(id, 0));
    const bogus = { entryIds: ["x"], userIds: ["p01", "p73"], eventId: null, cohesion: {} as never };
    const r = runTick(q, people, landmarks, { now: 0, fillMode: "simulated" }, () => bogus);
    expect(r[0].chosen.userIds).not.toContain("p73");
    expect(r[0].chosen.userIds).toHaveLength(6);
  });
});
