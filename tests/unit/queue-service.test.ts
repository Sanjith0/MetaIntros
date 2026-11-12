import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { seedDatabase } from "@/lib/seed/seed";
import { getQueueStatus, joinQueue, leaveQueue, tick } from "@/lib/server/queue";
import { setSetting } from "@/lib/server/settings";

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
    const trace = await prisma.agentTrace.findMany({ where: { partyId: party.id, agent: "party_formation" } });
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
});
