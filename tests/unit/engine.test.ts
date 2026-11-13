import { describe, expect, it } from "vitest";
import LANDMARKS from "@/data/seed/landmarks.json";
import { eligiblePool, findProposal, LEVELS, LIVE_FLOOR_LEVEL, MAX_ROOM, runRoomsAsync, runTick, type Candidate, type EngineOptions, type QueueItem } from "@/lib/match/engine";
import { groupCohesion } from "@/lib/match/cohesion";
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

describe("Companion-engine rooms", () => {
  const opts: EngineOptions = { now: 0, fillMode: "simulated" };
  const adults = [...people.values()].filter((p) => p.ageBand === "18-24" && !p.womenOnlyParty && p.blocked.size === 0).map((p) => p.id).sort();
  const cand = (items: QueueItem[]): Candidate => ({ entryIds: items.map((i) => i.entryId), userIds: items.map((i) => i.userId), eventId: null, cohesion: groupCohesion(items.map((i) => people.get(i.userId)!)) });

  it("eligiblePool is everyone the anchor could be matched with: same size and queue, allowed, not the anchor", () => {
    const pool = [item("p01", 0, { isSimulated: false }), item("p09", 1), item(adults[0], 2), item(adults[1], 3, { targetSize: 4 }), item(adults[2], 4, { mode: "hangout" }), item(adults[3], 5, { eventId: "ev-a" })];
    const got = eligiblePool(pool[0], pool, people, landmarks, opts)!;
    expect(got.items.map((i) => i.userId)).toEqual([adults[0], adults[3]]); // p09 is blocked, wrong size and wrong queue are out
    expect(got.index).toBe(0);
  });

  it("the room is capped, skips anchors with too few people, and never mixes two specific events", async () => {
    const many = adults.slice(0, 40).map((id, i) => item(id, i, { targetSize: 4 }));
    const rooms: QueueItem[][] = [];
    await runRoomsAsync(many, people, landmarks, opts, async (_a, room) => (rooms.push(room), []), async () => true);
    expect(rooms[0]).toHaveLength(MAX_ROOM);
    expect(rooms[0][0].userId).toBe(adults[0]);

    const few = adults.slice(0, 3).map((id, i) => item(id, i, { targetSize: 6 }));
    let called = 0;
    await runRoomsAsync(few, people, landmarks, opts, async () => (called++, []), async () => true);
    expect(called).toBe(0);

    const mixed = [item(adults[0], 0, { targetSize: 3 }), item(adults[1], 1, { targetSize: 3, eventId: "ev-a" }), item(adults[2], 2, { targetSize: 3, eventId: "ev-b" }), item(adults[3], 3, { targetSize: 3 })];
    const seen: QueueItem[][] = [];
    await runRoomsAsync(mixed, people, landmarks, opts, async (_a, room) => (seen.push(room), []), async () => true);
    expect(seen[0].map((r) => r.userId)).toEqual([adults[0], adults[1], adults[3]]); // ev-b can't join a room going to ev-a
  });

  it("only commits squads that pass the code checks, and uses a room once per tick", async () => {
    const items = adults.slice(0, 9).map((id, i) => item(id, i, { targetSize: 3 }));
    const blockedPair = [item("p01", 0, { targetSize: 3 }), item("p09", 1, { targetSize: 3 }), item(adults[0], 2, { targetSize: 3 })];
    const committed: string[][] = [];
    const commit = async (_p: unknown, c: Candidate) => (committed.push(c.userIds), true);
    const formed = await runRoomsAsync(items, people, landmarks, opts, async (_a, room) => [
      cand(room.slice(0, 2)), // wrong size
      cand([room[0], room[0], room[1]]), // duplicate
      { ...cand(room.slice(0, 3)), userIds: [room[5].userId, room[1].userId, room[2].userId] }, // ids don't match entries
      cand(room.slice(0, 3)), // ok
      cand(room.slice(2, 5)), // reuses a taken entry
      cand(room.slice(3, 6)), // ok
    ], commit);
    expect(formed).toBe(2);
    expect(committed).toEqual([adults.slice(0, 3), adults.slice(3, 6)]); // and the 3 left over did not get a second room this tick
    committed.length = 0;
    // an unsafe squad is never committed, whatever the engine returns
    expect(await runRoomsAsync([blockedPair[0], blockedPair[2], item(adults[1], 3, { targetSize: 3 })], people, landmarks, opts, async () => [cand(blockedPair)], commit)).toBe(0);
    expect(committed).toEqual([]);
  });
});
