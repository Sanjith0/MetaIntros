import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { seedDatabase } from "@/lib/seed/seed";
import { joinQueue } from "@/lib/server/queue";
import { setSetting } from "@/lib/server/settings";
import { fastForward } from "@/lib/server/expiry";
import { getRatingState, ratingSignals, skipRating, submitRating } from "@/lib/server/ratings";
import { decorateEvents } from "@/lib/server/events";
import { ratingSteps } from "@/lib/server/pipeline";
import {
  AGAIN_MUTUAL_BONUS,
  AGAIN_ONE_WAY_BONUS,
  againPairsIn,
  applyAvoids,
  eventAffinity,
  pairAvoided,
  pairBonus,
  pairSignals,
  ratingAwareScorer,
  tagAffinity,
} from "@/lib/match/ratings";
import { scoreEvent, type GroupContext } from "@/lib/match/eventFit";
import { tickAndAccept } from "../helpers/squad";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("ratings → signals (pure)", () => {
  it("stars teach tag affinity: loved nights go up, bad nights go down, 3★ is neutral", () => {
    const a = tagAffinity([
      { stars: 5, tags: ["climbing", "coffee"] },
      { stars: 1, tags: ["karaoke"] },
      { stars: 3, tags: ["trivia"] },
    ]);
    expect(a.get("climbing")).toBe(0.5);
    expect(a.get("karaoke")).toBe(-0.5);
    expect(a.has("trivia")).toBe(false);
    expect(eventAffinity(["climbing", "coffee", "x"], a)).toBe(1);
  });

  it("affinity is capped and ignores out-of-range stars", () => {
    const a = tagAffinity([...Array(10)].map(() => ({ stars: 5, tags: ["run-club"] })).concat([{ stars: 9, tags: ["bad"] }]));
    expect(a.get("run-club")).toBe(1);
    expect(a.has("bad")).toBe(false);
  });

  it("again: one-way and mutual bonuses; not again wins and is symmetric", () => {
    const s = pairSignals([
      { raterId: "a", rateeId: "b", verdict: "again" },
      { raterId: "b", rateeId: "a", verdict: "again" },
      { raterId: "a", rateeId: "c", verdict: "again" },
      { raterId: "d", rateeId: "a", verdict: "again" },
      { raterId: "a", rateeId: "d", verdict: "not_again" },
    ]);
    expect(pairBonus(s, "b", "a")).toBe(AGAIN_MUTUAL_BONUS);
    expect(pairBonus(s, "c", "a")).toBe(AGAIN_ONE_WAY_BONUS);
    expect(pairBonus(s, "a", "d")).toBe(0);
    expect(pairAvoided(s, "d", "a")).toBe(true);
    expect(againPairsIn(["a", "b", "c", "d"], s)).toBe(2);
  });

  it("a later rating of the same person replaces the earlier one", () => {
    const s = pairSignals([
      { raterId: "a", rateeId: "b", verdict: "not_again" },
      { raterId: "a", rateeId: "b", verdict: "again" },
    ]);
    expect(pairAvoided(s, "a", "b")).toBe(false);
    expect(pairBonus(s, "a", "b")).toBe(AGAIN_ONE_WAY_BONUS);
  });

  it("the scorer lifts rated pairs only, capped at 1", () => {
    const s = pairSignals([{ raterId: "a", rateeId: "b", verdict: "again" }]);
    const base = (x: { id: string }, y: { id: string }) => ({ score: x.id === "a" && y.id === "b" ? 0.95 : 0.5, breakdown: {} as never });
    const sc = ratingAwareScorer(base as never, s) as unknown as typeof base;
    expect(sc({ id: "a" }, { id: "b" }).score).toBe(1);
    expect(sc({ id: "a" }, { id: "c" }).score).toBe(0.5);
  });

  it("not again keeps a pair apart, except people who queued together", () => {
    const s = pairSignals([
      { raterId: "a", rateeId: "b", verdict: "not_again" },
      { raterId: "a", rateeId: "c", verdict: "not_again" },
    ]);
    const people = new Map(["a", "b", "c"].map((id) => [id, { id, blocked: new Set<string>() }]));
    applyAvoids(people, s, (x, y) => [x, y].sort().join() === "a,c");
    expect(people.get("a")!.blocked.has("b")).toBe(true);
    expect(people.get("b")!.blocked.has("a")).toBe(true);
    expect(people.get("a")!.blocked.has("c")).toBe(false);
  });

  it("event fit: ratings lift similar events and add a reason; no ratings → unchanged score", () => {
    const e = { id: "e", title: "Boulder social", tags: ["climbing"], startsAt: new Date(2030, 0, 4, 18), endsAt: new Date(2030, 0, 4, 20), lat: 37.44, lng: -122.16, isPublicVenue: true, capacity: 20 };
    const g: GroupContext = { sharedWindows: [{ dayOfWeek: 5, startMin: 0, endMin: 1440 }], tagCounts: new Map([["climbing", 2]]), dislikes: new Map(), center: { lat: 37.44, lng: -122.16 }, size: 4 };
    const now = new Date(2030, 0, 1);
    const plain = scoreEvent(e, g, now);
    const rated = scoreEvent(e, { ...g, ratedTags: new Map([["climbing", 2]]) }, now);
    expect(plain.rated).toBe(0);
    expect(rated.score).toBeGreaterThan(plain.score);
    expect(rated.reasons).toContain("Your squad rated nights like this highly");
    expect(plain.reasons).not.toContain("Your squad rated nights like this highly");
  });
});

describe("ratings (server)", () => {
  let partyId: string;
  let mates: string[];

  beforeEach(async () => {
    await seedDatabase(prisma, { now: new Date() });
    await setSetting("simFillMs", "0");
    await joinQueue("p01", { eventId: "ev-indie-guild", targetSize: 4, landmarkId: "lm-downtown-pa", locationSource: "manual" });
    await wait(300);
    await tickAndAccept();
    const party = await prisma.party.findFirstOrThrow({ where: { members: { some: { userId: "p01" } } }, include: { members: true } });
    partyId = party.id;
    mates = party.members.map((m) => m.userId).filter((id) => id !== "p01");
  });

  it("rating opens only after the chat ends, and only for squad members", async () => {
    const before = await getRatingState(partyId, "p01");
    expect(before).toMatchObject({ ended: false, askNow: false, mine: null });
    expect(await submitRating(partyId, "p01", { stars: 5 })).toEqual({ ok: false, error: "not_ended" });
    await fastForward();
    expect((await getRatingState(partyId, "p01"))!.askNow).toBe(true);
    const outsider = (await prisma.user.findFirstOrThrow({ where: { id: { notIn: ["p01", ...mates] } } })).id;
    expect(await getRatingState(partyId, outsider)).toBeNull();
    expect(await submitRating(partyId, outsider, { stars: 5 })).toEqual({ ok: false, error: "not_found" });
  });

  it("saves stars and per-mate verdicts; rejects bad input; can be edited", async () => {
    await fastForward();
    expect(await submitRating(partyId, "p01", { stars: 0 })).toEqual({ ok: false, error: "bad_stars" });
    expect(await submitRating(partyId, "p01", { stars: 4, mates: { p01: "again" } })).toEqual({ ok: false, error: "bad_mate" });
    expect(await submitRating(partyId, "p01", { stars: 4, mates: { [mates[0]]: "meh" } })).toEqual({ ok: false, error: "bad_mate" });
    expect(await submitRating(partyId, "p01", { stars: 4, mates: { [mates[0]]: "again", [mates[1]]: "not_again" } })).toEqual({ ok: true });
    let s = (await getRatingState(partyId, "p01"))!;
    expect(s.askNow).toBe(false);
    expect(s.mine).toEqual({ stars: 4, mates: { [mates[0]]: "again", [mates[1]]: "not_again" } });
    await submitRating(partyId, "p01", { stars: 5, mates: { [mates[0]]: "again" } });
    s = (await getRatingState(partyId, "p01"))!;
    expect(s.mine).toEqual({ stars: 5, mates: { [mates[0]]: "again" } });
    expect(await prisma.mateRating.count({ where: { partyId, raterId: "p01" } })).toBe(1);
  });

  it("privacy: a squadmate's state never includes anyone else's answers", async () => {
    await fastForward();
    await submitRating(partyId, "p01", { stars: 2, mates: { [mates[0]]: "not_again" } });
    const theirs = (await getRatingState(partyId, mates[0]))!;
    expect(theirs.mine).toBeNull();
    expect(JSON.stringify(theirs)).not.toContain("not_again");
    // the trace line the whole squad can read has no names and no counts
    const steps = await ratingSteps(["p01", ...mates]);
    for (const st of steps) for (const id of ["p01", ...mates]) expect(st.summary).not.toContain(id);
  });

  it("Not now stops the pop-up but keeps rating possible", async () => {
    await fastForward();
    await skipRating(partyId, "p01");
    const s = (await getRatingState(partyId, "p01"))!;
    expect(s.askNow).toBe(false);
    expect(s.mine?.stars).toBeNull();
    expect(await submitRating(partyId, "p01", { stars: 3 })).toEqual({ ok: true });
  });

  it("stars tune For you: events like a loved night rank higher and say why", async () => {
    await fastForward();
    const ev = await prisma.event.findUniqueOrThrow({ where: { id: "ev-indie-guild" } });
    const tags = ev.tags as string[];
    const before = await decorateEvents("p01", await prisma.event.findMany({ where: { kind: "event" } }));
    await submitRating(partyId, "p01", { stars: 5 });
    const after = await decorateEvents("p01", await prisma.event.findMany({ where: { kind: "event" } }));
    const similar = after.find((e) => e.id !== ev.id && e.tagsList.some((t) => tags.includes(t)));
    expect(similar).toBeTruthy();
    expect(similar!.ratedBoost).toBeGreaterThan(0);
    expect(similar!.relevance).toBeGreaterThan(before.find((e) => e.id === similar!.id)!.relevance);
    const unrelated = after.find((e) => !e.tagsList.some((t) => tags.includes(t)))!;
    expect(unrelated.ratedBoost).toBe(0);
  });

  async function queueAgain() {
    const { now } = await import("@/lib/server/clock");
    const t = await now();
    const next = await prisma.event.findFirstOrThrow({ where: { kind: "event", isPublicVenue: true, startsAt: { gt: t } }, orderBy: { startsAt: "asc" } });
    expect((await joinQueue("p01", { eventId: next.id, targetSize: 4, landmarkId: "lm-downtown-pa", locationSource: "manual" })).ok).toBe(true);
    await wait(300);
    await tickAndAccept();
    const party = await prisma.party.findFirst({ where: { id: { not: partyId }, members: { some: { userId: "p01" } }, status: { not: "cancelled" } }, include: { members: true } });
    expect(party).toBeTruthy();
    return party!;
  }

  it("control: without ratings, the next squad reuses the most compatible people", async () => {
    await fastForward();
    const next = await queueAgain();
    expect(next.members.some((m) => mates.includes(m.userId))).toBe(true);
  });

  it("not again: the next squad never includes those people (matching and filler picks)", async () => {
    await fastForward();
    await submitRating(partyId, "p01", { stars: 4, mates: Object.fromEntries(mates.map((m) => [m, "not_again"])) });
    expect(pairAvoided(await ratingSignals(["p01", mates[0]]), "p01", mates[0])).toBe(true);
    const next = await queueAgain();
    expect(next.members.some((m) => mates.includes(m.userId))).toBe(false);
  });

  it("again: people you'd squad up with again are picked first, and the trace says ratings were used without names", async () => {
    await fastForward();
    await submitRating(partyId, "p01", { stars: 5, mates: Object.fromEntries(mates.map((m) => [m, "again"])) });
    const next = await queueAgain();
    expect(next.members.filter((m) => mates.includes(m.userId)).length).toBeGreaterThan(0);
    const trace = await prisma.agentTrace.findMany({ where: { partyId: next.id, agent: "ratings" } });
    expect(trace).toHaveLength(1);
    expect(trace[0].summary).toMatch(/nobody sees who rated whom/);
    for (const id of ["p01", ...mates]) expect(trace[0].summary).not.toContain(id);
  });
});
