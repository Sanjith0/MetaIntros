import { beforeEach, describe, expect, it } from "vitest";
import fc from "fast-check";
import LANDMARKS from "@/data/seed/landmarks.json";
import SPOTS from "@/data/seed/spots.json";
import { mockProvider } from "@/lib/ai";
import { hangoutPlannerAgent } from "@/lib/agents/hangoutPlanner";
import { haversineKm } from "@/lib/geo";
import { groupCohesion } from "@/lib/match/cohesion";
import { coversRange } from "@/lib/match/availability";
import { findProposal, runTick, queuesCompatible, type QueueItem, type Candidate } from "@/lib/match/engine";
import { findSlot, MAX_HANGOUT_KM, rankHangouts, scoreHangout, type HangoutGroup, type Spot } from "@/lib/match/hangoutFit";
import { makePairScorer } from "@/lib/match/compat";
import { groupContext } from "@/lib/server/pipeline";
import { isSensitiveText } from "@/lib/cards/claims";
import { loadPeopleFromFiles } from "../helpers/people";

const NOW = new Date(2026, 10, 12, 9); // Thu 9am
const HORIZON = new Date(NOW.getTime() + 7 * 86_400_000);
const spots = SPOTS as Spot[];
const people = loadPeopleFromFiles();
const pa = LANDMARKS.find((l) => l.id === "lm-downtown-pa")!;
const shoreline = LANDMARKS.find((l) => l.id === "lm-shoreline")!;

function group(ids: string[], areas: { lat: number; lng: number }[] = [pa]): HangoutGroup {
  const members = ids.map((i) => people.get(i)!);
  const cand: Candidate = { entryIds: ids, userIds: ids, eventId: null, cohesion: groupCohesion(members) };
  const g = groupContext(members, cand, pa);
  return { sharedWindows: g.sharedWindows, tagCounts: g.tagCounts, dislikes: g.dislikes, size: g.size, memberAreas: areas };
}
const boardGamers = ["p21", "p22", "p23", "p24"];

describe("hangout planning (pure)", () => {
  const spot: Spot = { ...spots[0], openMin: 600, closeMin: 1200, durationMin: 120 };

  it("findSlot: inside the shared window and opening hours, at least an hour out", () => {
    const sat = { dayOfWeek: 6, startMin: 8 * 60, endMin: 14 * 60 };
    const s = findSlot([sat], spot, NOW, HORIZON)!;
    expect(s.startsAt.getDay()).toBe(6);
    expect(s.startsAt.getHours()).toBe(10); // spot opens at 10
    expect(s.endsAt.getTime() - s.startsAt.getTime()).toBe(120 * 60_000);
    // today (Thu) window that already started: begins ≥ now + 60min, rounded to :00/:30
    const thu = findSlot([{ dayOfWeek: 4, startMin: 0, endMin: 1440 }], spot, new Date(2026, 10, 12, 10, 10), HORIZON)!;
    expect(thu.startsAt).toEqual(new Date(2026, 10, 12, 11, 30));
    expect(findSlot([{ dayOfWeek: 6, startMin: 600, endMin: 660 }], spot, NOW, HORIZON)).toBeNull(); // too short
  });

  it("rejects private places, places far from someone, disliked activities, and no shared time", () => {
    const g = group(boardGamers);
    expect(scoreHangout({ ...spot, isPublic: false }, g, NOW, HORIZON).rejections).toContain("not a public place");
    const far = scoreHangout(spots.find((s) => s.landmarkId === "lm-shoreline")!, { ...g, memberAreas: [pa, { lat: 37.4863, lng: -122.2286 }] }, NOW, HORIZON);
    expect(far.ok).toBe(false);
    expect(far.rejections.join()).toMatch(/too far/);
    const disliked = scoreHangout({ ...spot, tags: ["karaoke"] }, { ...g, dislikes: new Map([["karaoke", ["p21"]]]) }, NOW, HORIZON);
    expect(disliked.rejections.join()).toMatch(/dislikes karaoke/);
    const noTime = scoreHangout(spot, { ...g, sharedWindows: [{ dayOfWeek: 1, startMin: 0, endMin: 30 }] }, NOW, HORIZON);
    expect(noTime.rejections).toContain("no shared free time while it's open");
  });

  it("no availability on file (live sign-ups) → proposes a weekend afternoon, flagged", () => {
    const o = scoreHangout(spot, { ...group(boardGamers), sharedWindows: [] }, NOW, HORIZON);
    expect(o.ok).toBe(true);
    expect(o.assumedTime).toBe(true);
    expect([5, 6, 0]).toContain(o.startsAt!.getDay());
  });

  it("ranks the spot that matches the squad's shared interest first", () => {
    const top = rankHangouts(spots, group(boardGamers), NOW, HORIZON)[0];
    expect(top.ok).toBe(true);
    expect(spots.find((s) => s.id === top.spotId)!.tags).toContain("board-games");
  });

  it("property: every 'ok' option is public, common ground for all, in shared time + hours, no dislikes", () => {
    const ids = [...people.keys()];
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.constantFrom(...ids), { minLength: 2, maxLength: 6 }),
        fc.array(fc.constantFrom(...LANDMARKS), { minLength: 1, maxLength: 3 }),
        fc.integer({ min: 0, max: 6 * 24 }),
        (members, areas, hourOffset) => {
          const now = new Date(NOW.getTime() + hourOffset * 3600_000);
          const horizon = new Date(now.getTime() + 7 * 86_400_000);
          const g = group(members, areas);
          for (const o of rankHangouts(spots.map((s, i) => ({ ...s, isPublic: i % 7 !== 3 })), g, now, horizon).filter((x) => x.ok)) {
            const s = spots.find((x) => x.id === o.spotId)!;
            expect(spots.indexOf(s) % 7).not.toBe(3);
            for (const a of areas) expect(haversineKm(a, s)).toBeLessThanOrEqual(MAX_HANGOUT_KM);
            expect(s.tags.some((t) => g.dislikes.has(t))).toBe(false);
            expect(o.startsAt!.getTime()).toBeGreaterThanOrEqual(now.getTime() + 3600_000);
            const sMin = o.startsAt!.getHours() * 60 + o.startsAt!.getMinutes();
            expect(sMin).toBeGreaterThanOrEqual(s.openMin);
            expect(sMin + s.durationMin).toBeLessThanOrEqual(s.closeMin);
            if (!o.assumedTime) expect(coversRange(g.sharedWindows, o.startsAt!, o.endsAt!)).toBe(true);
          }
        },
      ),
      { numRuns: 150 },
    );
  });
});

describe("Hangout Planner Agent", () => {
  beforeEach(() => mockProvider().reset());

  it("uses a valid model pick and its title", async () => {
    mockProvider().on("hangout_planner", (req) => {
      const opts = JSON.parse(req.messages[1].content).options as { id: string }[];
      return JSON.stringify({ choice: opts[0].id, title: "Dice & snacks night", plan: "Grab a table and learn a new game together.", reasons: ["All four of you play board games"] });
    });
    const r = (await hangoutPlannerAgent({ spots, group: group(boardGamers), now: NOW, horizon: HORIZON }))!;
    expect(r.source).toBe("mock");
    expect(r.title).toBe("Dice & snacks night");
    expect(r.steps.map((s) => s.kind)).toEqual(["tool_call", "reasoning", "safety_check", "decision"]);
    expect(mockProvider().calls).toHaveLength(1); // one call per hangout
  });

  it("hostile model: unverified spot is rejected, sensitive/overlong text is replaced", async () => {
    mockProvider().on("hangout_planner", () =>
      JSON.stringify({ choice: "sp-somebodys-house", title: "Pray together at the temple", plan: "x".repeat(239), reasons: ["Everyone votes the same way"] }),
    );
    const g = group(boardGamers);
    const r = (await hangoutPlannerAgent({ spots, group: g, now: NOW, horizon: HORIZON }))!;
    expect(rankHangouts(spots, g, NOW, HORIZON).find((o) => o.ok)!.spotId).toBe(r.spot.id);
    expect(r.steps.find((s) => s.kind === "safety_check")!.summary).toMatch(/rejected/);
    expect(isSensitiveText(r.title)).toBe(false);
    expect(r.reasons.some(isSensitiveText)).toBe(false);
    expect(r.title.length).toBeLessThanOrEqual(60);
  });

  it("valid pick but sensitive title → template title", async () => {
    mockProvider().on("hangout_planner", (req) => {
      const opts = JSON.parse(req.messages[1].content).options as { id: string }[];
      return JSON.stringify({ choice: opts[0].id, title: "Election watch party", plan: "Talk politics over coffee.", reasons: ["fun"] });
    });
    const r = (await hangoutPlannerAgent({ spots, group: group(boardGamers), now: NOW, horizon: HORIZON }))!;
    expect(r.title).toMatch(/hangout at/);
    expect(isSensitiveText(r.plan)).toBe(false);
  });

  it("model down → deterministic plan (no network needed)", async () => {
    const r = (await hangoutPlannerAgent({ spots, group: group(boardGamers), now: NOW, horizon: HORIZON }))!;
    expect(r.source).toBe("fallback");
    expect(r.title).toMatch(/hangout at/);
  });

  it("returns null when no spot is common ground (areas too far apart)", async () => {
    const r = await hangoutPlannerAgent({ spots, group: group(boardGamers, [shoreline, { lat: 37.7793, lng: -122.4193 }]), now: NOW, horizon: HORIZON });
    expect(r).toBeNull();
  });
});

describe("separate queues (engine)", () => {
  const landmarks = new Map(LANDMARKS.map((l) => [l.id, l]));
  const item = (userId: string, over: Partial<QueueItem> = {}): QueueItem => ({
    entryId: `e-${userId}`, userId, targetSize: 4, bucketId: "lm-downtown-pa", eventId: null, joinedAt: 0, isSimulated: true, ...over,
  });

  it("queuesCompatible: hangout only with hangout; any-event joins a specific event; two events never mix", () => {
    expect(queuesCompatible({ mode: "hangout", eventId: null }, { mode: "events", eventId: null })).toBe(false);
    expect(queuesCompatible({ mode: "hangout", eventId: null }, { mode: "hangout", eventId: null })).toBe(true);
    expect(queuesCompatible({ mode: "events", eventId: "a" }, { eventId: null })).toBe(true);
    expect(queuesCompatible({ eventId: "a" }, { eventId: "b" })).toBe(false);
  });

  it("a hangout queuer is never matched with existing-event queuers, even with nobody else around", () => {
    const anchor = item("p21", { mode: "hangout" });
    const others = ["p22", "p23", "p24", "p25", "p26"].map((u) => item(u, { mode: "events" }));
    expect(findProposal(anchor, [anchor, ...others], people, landmarks, { now: 60_000, fillMode: "simulated" }, makePairScorer())).toBeNull();
    const p = findProposal(anchor, [anchor, ...others.map((o) => ({ ...o, mode: "hangout" as const }))], people, landmarks, { now: 60_000, fillMode: "simulated" }, makePairScorer());
    expect(p?.mode).toBe("hangout");
  });

  it("property: every formed party comes from exactly one queue", () => {
    const ids = [...people.keys()];
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.constantFrom(...ids), { minLength: 8, maxLength: 40 }),
        fc.array(fc.constantFrom<[QueueItem["mode"], string | null]>(["hangout", null], ["events", null], ["events", "ev-indie-guild"], ["events", "ev-boulder-social"]), { minLength: 40, maxLength: 40 }),
        (users, queues) => {
          const byEntry = new Map<string, QueueItem>();
          const waiting = users.map((u, i) => {
            const it = item(u, { entryId: `e${i}`, mode: queues[i][0], eventId: queues[i][1], joinedAt: i * 100, targetSize: 3 });
            byEntry.set(it.entryId, it);
            return it;
          });
          for (const { chosen, proposal } of runTick(waiting, people, landmarks, { now: 120_000, fillMode: "simulated" })) {
            const members = chosen.entryIds.map((e) => byEntry.get(e)!);
            expect(new Set(members.map((m) => m.mode)).size).toBe(1);
            expect(members[0].mode).toBe(proposal.mode);
            expect(new Set(members.map((m) => m.eventId).filter(Boolean)).size).toBeLessThanOrEqual(1);
            if (proposal.mode === "hangout") expect(members.every((m) => m.eventId === null)).toBe(true);
          }
        },
      ),
      { numRuns: 60 },
    );
  });
});
