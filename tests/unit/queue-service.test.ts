import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { seedDatabase } from "@/lib/seed/seed";
import { getQueueStatus, joinQueue, leaveQueue, tick } from "@/lib/server/queue";
import { setSetting } from "@/lib/server/settings";
import { getEventDetail, getFeed, weekendRange } from "@/lib/server/events";
import { setClockOffsetMs, now as clockNow } from "@/lib/server/clock";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("queue service (DB)", () => {
  beforeEach(async () => {
    await seedDatabase(prisma, { now: new Date(2026, 10, 12, 9) });
    await setSetting("simFillMs", "0");
  });

  it("rejects private venues, bad sizes and far-away GPS", async () => {
    expect(await joinQueue("p01", { eventId: "ev-house-show", targetSize: 6, landmarkId: "lm-downtown-pa", locationSource: "manual" })).toMatchObject({ ok: false, error: "private_event" });
    expect(await joinQueue("p01", { eventId: null, targetSize: 9, landmarkId: "lm-downtown-pa", locationSource: "manual" })).toMatchObject({ ok: false, error: "bad_size" });
    expect(await joinQueue("p01", { eventId: null, targetSize: 6, lat: 37.7793, lng: -122.4193, locationSource: "gps" })).toMatchObject({ ok: false, error: "too_far" });
  });

  it("assigns GPS to a bucket and simulated users fill the party (simulated mode)", async () => {
    const r = await joinQueue("p01", { eventId: "ev-indie-guild", targetSize: 6, lat: 37.4447, lng: -122.1625, locationSource: "gps" });
    expect(r).toMatchObject({ ok: true, bucketId: "lm-downtown-pa" });
    await wait(300);
    const s = await getQueueStatus("p01");
    expect(s.state).toBe("waiting");
    expect(s.found).toBe(6);
    expect(await tick()).toBe(1);
    const done = await getQueueStatus("p01");
    expect(done.state).toBe("matched");
    const party = await prisma.party.findUniqueOrThrow({ where: { id: done.partyId! }, include: { members: true } });
    expect(party.status).toBe("confirmed");
    expect(party.eventId).toBe("ev-indie-guild");
    expect(party.members).toHaveLength(6);
    expect(party.members.map((m) => m.userId)).not.toContain("p09"); // Me blocked p09
    expect(party.rationale).toBeTruthy();
    const trace = await prisma.agentTrace.findMany({ where: { partyId: party.id, agent: { in: ["orchestrator", "companion"] } } });
    expect(trace.length).toBeGreaterThanOrEqual(5);
    // spare simulated joiners were withdrawn
    expect(await prisma.queueEntry.count({ where: { status: "waiting" } })).toBe(0);
  });

  it("live mode spawns no simulated users", async () => {
    await setSetting("fillMode", "live");
    await joinQueue("p01", { eventId: null, targetSize: 3, landmarkId: "lm-downtown-pa", locationSource: "manual" });
    await wait(200);
    expect(await prisma.queueEntry.count({ where: { status: "waiting" } })).toBe(1);
    expect(await tick()).toBe(0);
  });

  it("leaving the queue cancels the entry", async () => {
    await setSetting("fillMode", "live");
    await joinQueue("p01", { eventId: null, targetSize: 3, landmarkId: "lm-downtown-pa", locationSource: "manual" });
    await leaveQueue("p01");
    expect((await getQueueStatus("p01")).state).toBe("idle");
  });

  it("'anything this weekend' picks a public event inside the shared window", async () => {
    await joinQueue("p01", { eventId: null, targetSize: 6, landmarkId: "lm-downtown-pa", locationSource: "manual" });
    await wait(300);
    expect(await tick()).toBe(1);
    const party = await prisma.party.findFirstOrThrow({ where: { status: "confirmed" }, include: { event: true } });
    expect(party.event!.isPublicVenue).toBe(true);
  });
  it("hangout queue: plans a new, squad-only, public hangout (not an existing event)", async () => {
    const r = await joinQueue("p01", { mode: "hangout", eventId: null, targetSize: 4, landmarkId: "lm-downtown-pa", locationSource: "manual" });
    expect(r.ok).toBe(true);
    await wait(300);
    expect((await getQueueStatus("p01")).mode).toBe("hangout");
    expect(await tick()).toBe(1);
    const party = await prisma.party.findFirstOrThrow({ where: { status: "confirmed" }, include: { event: true, members: true, chat: true } });
    const ev = party.event!;
    expect(ev.kind).toBe("hangout");
    expect(ev.isPublicVenue).toBe(true);
    expect(ev.hostName).toBe("Queue Up");
    expect(ev.startsAt.getTime()).toBeGreaterThan(Date.now() - 1);
    expect(party.chat).toBeTruthy(); // squad chat, host, cards all run as usual
    // every queuer in this party was in the hangout queue
    const entries = await prisma.queueEntry.findMany({ where: { partyId: party.id } });
    expect(entries.every((e) => e.mode === "hangout" && e.eventId === null)).toBe(true);
    expect(await prisma.agentTrace.count({ where: { partyId: party.id, agent: "hangout_planner" } })).toBeGreaterThanOrEqual(3);
    expect(await prisma.agentTrace.count({ where: { partyId: party.id, agent: "event_selection" } })).toBe(0);
    // private to the squad: never in the feed, detail 404s for outsiders
    const feed = await getFeed("p01", "foryou", new Date(2026, 10, 12, 9));
    expect(feed.some((e) => e.id === ev.id)).toBe(false);
    expect(await getEventDetail("p01", ev.id)).not.toBeNull();
    const outsider = (await prisma.user.findFirstOrThrow({ where: { id: { notIn: party.members.map((m) => m.userId) } } })).id;
    expect(await getEventDetail(outsider, ev.id)).toBeNull();
    // nobody can queue into a squad's hangout
    expect(await joinQueue(outsider, { eventId: ev.id, targetSize: 4, landmarkId: "lm-downtown-pa", locationSource: "manual" })).toMatchObject({ ok: false, error: "no_event" });
  });

  it("hangout queue rejects an eventId; existing-events queue never yields a hangout", async () => {
    expect(await joinQueue("p01", { mode: "hangout", eventId: "ev-indie-guild", targetSize: 4, landmarkId: "lm-downtown-pa", locationSource: "manual" })).toMatchObject({ ok: false, error: "bad_mode" });
    await joinQueue("p01", { eventId: null, targetSize: 4, landmarkId: "lm-downtown-pa", locationSource: "manual" });
    await wait(300);
    expect(await tick()).toBe(1);
    const party = await prisma.party.findFirstOrThrow({ where: { status: "confirmed" }, include: { event: true } });
    expect(party.event!.kind).toBe("event");
  });
  it("clock fast-forwarded past every event: 'any event' queuers wait with a reason instead of form→cancel looping", async () => {
    await setClockOffsetMs(10 * 86_400_000); // what Fast-forward did during the live test
    await joinQueue("p01", { eventId: null, targetSize: 4, landmarkId: "lm-downtown-pa", locationSource: "manual" });
    await wait(300);
    expect(await tick()).toBe(0);
    expect(await tick()).toBe(0);
    expect(await prisma.party.count({ where: { status: "cancelled" } })).toBe(0); // no churn
    const s = await getQueueStatus("p01");
    expect(s).toMatchObject({ state: "waiting", problem: "no_events", bucketId: "lm-downtown-pa" });
    // the suggested way out: same size + area, new hangout queue
    expect((await joinQueue("p01", { mode: "hangout", eventId: null, targetSize: 4, landmarkId: s.bucketId, locationSource: "manual" })).ok).toBe(true);
    await wait(300);
    expect(await tick()).toBe(1);
    const party = await prisma.party.findFirstOrThrow({ where: { status: "confirmed" }, include: { event: true } });
    expect(party.event!.kind).toBe("hangout");
    expect(party.event!.startsAt.getTime()).toBeGreaterThan((await clockNow()).getTime());
    await setClockOffsetMs(0);
  });

  it("no event fits the squad: no squad is formed, the room is not re-run every tick, and the user sees a no_fit reason", async () => {
    // Move every event to Saturday 3:30am — inside the weekend, but outside anyone's free time.
    const { start } = weekendRange(await clockNow());
    const sat = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1, 3, 30);
    await prisma.event.updateMany({ where: { kind: "event" }, data: { startsAt: sat, endsAt: new Date(sat.getTime() + 3600_000) } });
    await joinQueue("p01", { eventId: null, targetSize: 4, landmarkId: "lm-downtown-pa", locationSource: "manual" });
    await wait(300);
    expect(await tick()).toBe(0);
    // The Companion engine checks a squad can actually meet before forming it, so nothing is formed then cancelled.
    expect(await prisma.party.count({ where: { status: "cancelled" } })).toBe(0);
    const rooms = await prisma.matchRoom.count();
    expect(rooms).toBe(1);
    for (let i = 0; i < 3; i++) expect(await tick()).toBe(0);
    expect(await prisma.matchRoom.count()).toBe(rooms); // the room is not re-run every tick
    expect(await prisma.party.count({ where: { status: "cancelled" } })).toBe(0);
    expect((await getQueueStatus("p01")).problem).toBe("no_fit");
  });
});
