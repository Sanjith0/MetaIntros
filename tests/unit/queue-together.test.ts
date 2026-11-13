import { beforeEach, describe, expect, it } from "vitest";
import fc from "fast-check";
import LANDMARKS from "@/data/seed/landmarks.json";
import { prisma } from "@/lib/db";
import { runTick, type QueueItem } from "@/lib/match/engine";
import { validateParty } from "@/lib/match/safety";
import { seedDatabase } from "@/lib/seed/seed";
import { getOrCreateGroup, inviteFriend, joinByCode, leaveGroup, myGroupState, respondToInvite } from "@/lib/server/groups";
import { getQueueStatus, joinQueue } from "@/lib/server/queue";
import { setSetting } from "@/lib/server/settings";
import { tickAndAccept } from "../helpers/squad";
import { joinFriendQueue, listFriendQueues, setQueueVisibility } from "@/lib/server/friendQueues";
import { createSampleLiveUser } from "@/lib/server/signup";
import { loadPeopleFromFiles } from "../helpers/people";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("queue together: engine", () => {
  const people = loadPeopleFromFiles();
  const landmarks = new Map(LANDMARKS.map((l) => [l.id, l]));
  const ids = [...people.keys()].filter((id) => people.get(id)!.ageBand === people.get("p01")!.ageBand);
  const item = (userId: string, i: number, over: Partial<QueueItem> = {}): QueueItem => ({
    entryId: `e${i}`, userId, targetSize: 4, bucketId: "lm-downtown-pa", eventId: null, joinedAt: i * 10, isSimulated: true, ...over,
  });

  it("a group is never split and every squad stays safe (property)", () => {
    fc.assert(
      fc.property(fc.uniqueArray(fc.constantFrom(...ids), { minLength: 10, maxLength: 30 }), fc.integer({ min: 2, max: 3 }), fc.integer({ min: 0, max: 5 }), (users, gsize, gstart) => {
        const groupUsers = users.slice(gstart, gstart + gsize);
        const waiting = users.map((u, i) => item(u, i, groupUsers.includes(u) ? { groupId: "g1" } : {}));
        const byEntry = new Map(waiting.map((w) => [w.entryId, w]));
        for (const { chosen } of runTick(waiting, people, landmarks, { now: 120_000, fillMode: "simulated" })) {
          const members = chosen.entryIds.map((e) => byEntry.get(e)!);
          const fromGroup = members.filter((m) => m.groupId === "g1").length;
          expect(fromGroup === 0 || fromGroup === groupUsers.length).toBe(true); // all or none
          expect(validateParty(chosen.userIds.map((u) => people.get(u)!)).ok).toBe(true);
          expect(chosen.userIds.length).toBe(4);
        }
      }),
      { numRuns: 80 },
    );
  });

  it("friends with nothing in common still squad up together (their pair counts as a strong match)", () => {
    // p01 (indie) + p21 (games): unlikely pair, but they chose each other
    const waiting = [item("p01", 0, { groupId: "g" }), item("p21", 1, { groupId: "g" }), ...["p03", "p05", "p22", "p23", "p11"].map((u, i) => item(u, i + 2))];
    const r = runTick(waiting, people, landmarks, { now: 60_000, fillMode: "simulated" });
    const withGroup = r.find((x) => x.chosen.userIds.includes("p01"));
    expect(withGroup?.chosen.userIds).toEqual(expect.arrayContaining(["p01", "p21"]));
  });
});

describe("queue together: service", () => {
  beforeEach(async () => {
    await seedDatabase(prisma, { now: new Date() });
    await setSetting("simFillMs", "0");
    await setSetting("simAcceptMs", "0");
  });

  it("invite → seeded friend accepts → host queues → the whole group lands in one squad", async () => {
    const friend = (await prisma.friendship.findFirstOrThrow({ where: { userAId: "p01" } })).userBId;
    const inv = await inviteFriend("p01", friend);
    expect(inv.ok).toBe(true);
    const g = (await myGroupState("p01")).group!;
    expect(g.members.find((m) => m.id === friend)?.status).toBe("joined"); // simulated friends accept
    await joinQueue("p01", { eventId: "ev-indie-guild", targetSize: 4, landmarkId: "lm-downtown-pa", locationSource: "manual" });
    const entries = await prisma.queueEntry.findMany({ where: { status: "waiting", groupId: g.id } });
    expect(entries.map((e) => e.userId).sort()).toEqual(["p01", friend].sort());
    expect((await getQueueStatus("p01")).together?.map((t) => t.id)).toEqual([friend]);
    await wait(300);
    expect(await tickAndAccept()).toBe(1);
    const party = await prisma.party.findFirstOrThrow({ where: { status: "confirmed" }, include: { members: true } });
    expect(party.members.map((m) => m.userId)).toEqual(expect.arrayContaining(["p01", friend]));
    expect(party.members).toHaveLength(4);
    expect(await prisma.agentTrace.count({ where: { partyId: party.id, summary: { contains: "queued as a group" } } })).toBe(1);
    expect((await prisma.queueGroup.findUniqueOrThrow({ where: { id: g.id } })).status).toBe("matched");
  });

  it("join by code works for people who aren't friends, but never across safety rules", async () => {
    const host = await createSampleLiveUser(prisma, { name: "Host", ageBand: "18-24", gender: null, womenOnlyParty: false });
    const pal = await createSampleLiveUser(prisma, { name: "Pal", ageBand: "18-24", gender: null, womenOnlyParty: false });
    const older = await createSampleLiveUser(prisma, { name: "Older", ageBand: "25+", gender: null, womenOnlyParty: false });
    const g = await getOrCreateGroup(host.userId);
    if (!g.ok) throw new Error("no group");
    expect((await joinByCode(pal.userId, g.group.code.toLowerCase())).ok).toBe(true);
    expect(await joinByCode(older.userId, g.group.code)).toEqual({ ok: false, error: "unsafe" }); // different age band
    // blocked (p01 blocked p09): p09 can't join a group p01 is in
    const g2 = await getOrCreateGroup("p01");
    if (!g2.ok) throw new Error("no group");
    expect(await joinByCode("p09", g2.group.code)).toEqual({ ok: false, error: "unsafe" });
    expect(await joinByCode(host.userId, "ZZZZ")).toEqual({ ok: false, error: "not_found" });
  });

  it("invites are friends-only; declining and leaving work; an open group closes when its host leaves", async () => {
    const stranger = await createSampleLiveUser(prisma, { name: "Stranger", ageBand: "18-24", gender: null, womenOnlyParty: false });
    expect(await inviteFriend("p01", stranger.userId)).toEqual({ ok: false, error: "not_friends" });
    const live = await createSampleLiveUser(prisma, { name: "Live friend", ageBand: "18-24", gender: null, womenOnlyParty: false });
    await prisma.friendship.create({ data: { userAId: "p01" < live.userId ? "p01" : live.userId, userBId: "p01" < live.userId ? live.userId : "p01", source: "existing" } });
    const r = await inviteFriend("p01", live.userId);
    expect(r.ok && r.group.members.find((m) => m.id === live.userId)?.status).toBe("invited"); // real people tap Join
    expect((await myGroupState(live.userId)).invites).toHaveLength(1);
    const gid = (await myGroupState("p01")).group!.id;
    expect((await respondToInvite(live.userId, gid, false)).ok).toBe(true);
    expect((await myGroupState(live.userId)).invites).toHaveLength(0);
    await leaveGroup("p01");
    expect((await prisma.queueGroup.findUniqueOrThrow({ where: { id: gid } })).status).toBe("closed");
  });

  it("feature: a friend sees your queue status and Join puts them in your squad", async () => {
    const friend = (await prisma.friendship.findFirstOrThrow({ where: { userAId: "p01" } })).userBId;
    await setQueueVisibility("p01", "friends");
    await setSetting("fillMode", "live"); // no simulated fillers yet, so p01 keeps waiting
    await joinQueue("p01", { eventId: null, targetSize: 4, landmarkId: "lm-downtown-pa", locationSource: "manual" });
    const q = (await listFriendQueues(friend))[0];
    expect(q).toMatchObject({ state: "waiting", canJoinTogether: true, together: 0 });
    expect(q.found).toBeGreaterThanOrEqual(1);
    const r = await joinFriendQueue(friend, q.entryId);
    expect(r.ok).toBe(true);
    const mine = await prisma.queueEntry.findFirstOrThrow({ where: { userId: "p01", status: "waiting" } });
    const theirs = await prisma.queueEntry.findFirstOrThrow({ where: { userId: friend, status: "waiting" } });
    expect(theirs.groupId).toBe(mine.groupId);
    expect(theirs.groupId).not.toBeNull();
    expect((await getQueueStatus("p01")).together?.map((t) => t.id)).toEqual([friend]);
    // the next friend sees them together
    const third = (await prisma.friendship.findMany({ where: { userAId: "p01" } })).map((f) => f.userBId).find((id) => id !== friend);
    if (third) expect((await listFriendQueues(third))[0]?.together).toBe(1);
  });

  it("a group can't fill the whole squad: at least one new person (size − 1 cap)", async () => {
    const friends = (await prisma.friendship.findMany({ where: { OR: [{ userAId: "p01" }, { userBId: "p01" }] } })).map((f) => (f.userAId === "p01" ? f.userBId : f.userAId));
    for (const f of friends.slice(0, 6)) await inviteFriend("p01", f);
    const g = (await myGroupState("p01")).group!;
    expect(g.members.filter((m) => m.status === "joined").length).toBeLessThanOrEqual(5);
    await joinQueue("p01", { eventId: null, targetSize: 4, landmarkId: "lm-downtown-pa", locationSource: "manual" });
    expect(await prisma.queueEntry.count({ where: { groupId: g.id, status: "waiting" } })).toBeLessThanOrEqual(3);
  });
});
