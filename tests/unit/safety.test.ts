import { describe, expect, it } from "vitest";
import fc from "fast-check";
import LANDMARKS from "@/data/seed/landmarks.json";
import { runTick, type FillMode, type QueueItem } from "@/lib/match/engine";
import { pairAllowed, validateParty } from "@/lib/match/safety";
import { rankEvents } from "@/lib/match/eventFit";
import { buildTasteProfile } from "@/lib/profile/builder";
import { graphFromSignup } from "@/lib/signup";
import { SIGNUP_CHIPS } from "@/lib/graph/vocabulary";
import { AGE_BANDS, isMinorBand } from "@/lib/domain/enums";
import type { Person } from "@/lib/profile/load";

const landmarks = new Map(LANDMARKS.map((l) => [l.id, l]));
const CHIP_TAGS = SIGNUP_CHIPS.map((c) => c.tag);
const SLOTS = ["fri-eve", "sat-am", "sat-pm", "sat-eve", "sun-am", "sun-pm", "sun-eve"] as const;

const personArb = (i: number) =>
  fc.record({
    // weighted so groups actually form, but every band (incl. minors) appears
    ageBand: fc.constantFrom(...AGE_BANDS, "18-24", "16-17", "18-24"),
    gender: fc.constantFrom("woman", "man", "nonbinary", null),
    womenOnlyParty: fc.integer({ min: 0, max: 4 }).map((x) => x === 0),
    interests: fc.uniqueArray(fc.constantFrom(...CHIP_TAGS), { minLength: 5, maxLength: 8 }),
    availability: fc.uniqueArray(fc.constantFrom(...SLOTS), { minLength: 1, maxLength: 4 }),
    bucket: fc.constantFrom(...LANDMARKS.map((l) => l.id)),
    size: fc.constantFrom(2, 3, 3, 4, 6, 8),
    joinedAt: fc.integer({ min: 0, max: 60_000 }),
    simulated: fc.boolean(),
  }).map((r) => ({ ...r, id: `u${i}` }));

const worldArb = fc
  .integer({ min: 10, max: 50 })
  .chain((n) =>
    fc.tuple(
      fc.tuple(...Array.from({ length: n }, (_, i) => personArb(i))),
      fc.array(fc.tuple(fc.nat(n - 1), fc.nat(n - 1)), { maxLength: n }),
      fc.constantFrom<FillMode>("simulated", "mixed", "live"),
    ),
  );

function buildWorld([raw, blocks]: [ReturnType<typeof personArb> extends fc.Arbitrary<infer T> ? T[] : never, [number, number][]]) {
  const people = new Map<string, Person>();
  for (const r of raw) {
    const g = graphFromSignup(r.id, {
      name: `Person ${r.id}`, ageBand: r.ageBand, gender: r.gender as never, womenOnlyParty: r.womenOnlyParty,
      interests: r.interests as never, dislikes: [], availability: r.availability as never,
    });
    people.set(r.id, {
      id: r.id, name: r.id, ageBand: r.ageBand, gender: r.gender, womenOnlyParty: r.womenOnlyParty,
      homeLat: null, homeLng: null, isSimulated: r.simulated, isLive: !r.simulated, avatarColor: "#000",
      profile: buildTasteProfile(g), friends: new Set(), blocked: new Set(),
    });
  }
  for (const [a, b] of blocks) {
    if (a === b) continue;
    people.get(`u${a}`)!.blocked.add(`u${b}`);
    people.get(`u${b}`)!.blocked.add(`u${a}`);
  }
  const queue: QueueItem[] = raw.map((r) => ({
    entryId: `e${r.id}`, userId: r.id, targetSize: r.size, bucketId: r.bucket, eventId: null, joinedAt: r.joinedAt, isSimulated: r.simulated,
  }));
  return { people, queue };
}

function assertInvariants(userIds: string[], people: Map<string, Person>) {
  const ms = userIds.map((u) => people.get(u)!);
  const bands = new Set(ms.map((m) => m.ageBand));
  expect(bands.size).toBe(1); // users only match within their own age band
  const hasMinor = ms.some((m) => isMinorBand(m.ageBand as never));
  const hasAdult = ms.some((m) => !isMinorBand(m.ageBand as never));
  expect(hasMinor && hasAdult).toBe(false); // minors and adults NEVER together
  if (ms.some((m) => m.womenOnlyParty)) expect(ms.every((m) => m.gender === "woman")).toBe(true);
  for (const a of ms) for (const b of ms) if (a !== b) expect(a.blocked.has(b.id)).toBe(false);
  expect(new Set(userIds).size).toBe(userIds.length);
}

describe("safety invariants (property-based)", () => {
  it("hold for every party formed from random queues, at every widening level and fill mode", () => {
    let formed = 0;
    fc.assert(
      fc.property(worldArb, ([raw, blocks, fillMode]) => {
        const { people, queue } = buildWorld([raw as never, blocks]);
        const waiting = [...queue];
        for (let t = 0; t <= 150_000; t += 5_000) {
          const res = runTick(waiting.filter((w) => w.joinedAt <= t), people, landmarks, { now: t, fillMode, liveFloor: true });
          for (const { chosen } of res) {
            formed++;
            assertInvariants(chosen.userIds, people);
            if (fillMode === "live") expect(chosen.userIds.every((u) => !people.get(u)!.isSimulated)).toBe(true);
            for (const id of chosen.entryIds) waiting.splice(waiting.findIndex((w) => w.entryId === id), 1);
          }
        }
      }),
      { numRuns: 120 },
    );
    expect(formed).toBeGreaterThan(100); // the property is exercised, not vacuous
  });

  it("hold even when a (malicious/buggy) agent tries to pick an unsafe group", () => {
    fc.assert(
      fc.property(worldArb, fc.nat(), ([raw, blocks, fillMode], seed) => {
        const { people, queue } = buildWorld([raw as never, blocks]);
        const ids = [...people.keys()];
        const evil = () => {
          const pick = ids.filter((_, i) => (i * 7 + seed) % 3 === 0).slice(0, 6);
          return { entryIds: pick.map((p) => `e${p}`), userIds: pick, eventId: null, cohesion: {} as never };
        };
        const res = runTick(queue, people, landmarks, { now: 200_000, fillMode, liveFloor: true }, evil);
        for (const { chosen } of res) assertInvariants(chosen.userIds, people);
      }),
      { numRuns: 80 },
    );
  });

  it("events at private venues are never considered a valid fit", () => {
    fc.assert(
      fc.property(fc.array(fc.record({ pub: fc.boolean(), day: fc.integer({ min: 0, max: 2 }), hour: fc.integer({ min: 8, max: 21 }), tag: fc.constantFrom(...CHIP_TAGS) }), { minLength: 1, maxLength: 12 }), (evs) => {
        const now = new Date(2026, 10, 12, 9);
        const events = evs.map((e, i) => {
          const startsAt = new Date(2026, 10, 13 + e.day, e.hour);
          return { id: `ev${i}`, title: "x", tags: [e.tag], startsAt, endsAt: new Date(startsAt.getTime() + 2 * 3600_000), lat: 37.44, lng: -122.16, isPublicVenue: e.pub, capacity: 50 };
        });
        const ctx = {
          sharedWindows: [5, 6, 0].map((d) => ({ dayOfWeek: d, startMin: 0, endMin: 1440 })),
          tagCounts: new Map([[evs[0].tag, 3]]), dislikes: new Map(), center: { lat: 37.44, lng: -122.16 }, size: 3,
        };
        for (const r of rankEvents(events, ctx, now)) if (r.ok) expect(events.find((e) => e.id === r.eventId)!.isPublicVenue).toBe(true);
        for (const e of events.filter((x) => !x.isPublicVenue)) expect(validateParty([], e).violations.some((v) => v.rule === "public_venue")).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});

describe("safety rules (examples)", () => {
  const P = (id: string, over: Partial<Person> = {}) => ({ id, ageBand: "18-24", gender: "woman", womenOnlyParty: false, blocked: new Set<string>(), ...over });
  it("age bands never mix (16-17 vs 18-24)", () => {
    expect(pairAllowed(P("a", { ageBand: "16-17" }), P("b"))).toBe(false);
    expect(validateParty([P("a", { ageBand: "16-17" }), P("b")]).violations[0].rule).toBe("age_band");
    expect(pairAllowed(P("a", { ageBand: "13-15" }), P("b", { ageBand: "13-15" }))).toBe(true);
  });
  it("women-only users only join all-women parties", () => {
    expect(pairAllowed(P("a", { womenOnlyParty: true }), P("b", { gender: "man" }))).toBe(false);
    expect(pairAllowed(P("a", { womenOnlyParty: true }), P("b", { gender: "nonbinary" }))).toBe(false);
    expect(pairAllowed(P("a", { womenOnlyParty: true }), P("b"))).toBe(true);
    expect(validateParty([P("a", { womenOnlyParty: true }), P("b"), P("c", { gender: null })]).ok).toBe(false);
  });
  it("blocked users never match, in either direction", () => {
    expect(pairAllowed(P("a", { blocked: new Set(["b"]) }), P("b"))).toBe(false);
    expect(pairAllowed(P("a"), P("b", { blocked: new Set(["a"]) }))).toBe(false);
  });
  it("public venues only; sizes 2–8; no duplicates", () => {
    expect(validateParty([P("a"), P("b")], { id: "e", isPublicVenue: false }).violations.map((v) => v.rule)).toEqual(["public_venue"]);
    expect(validateParty([P("a")]).violations.map((v) => v.rule)).toContain("size");
    expect(validateParty([P("a"), P("a")]).violations.map((v) => v.rule)).toContain("duplicate");
  });
});
