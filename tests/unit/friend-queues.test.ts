import { beforeEach, describe, expect, it } from "vitest";
import fc from "fast-check";
import { canJoinFriendQueue, canSeeQueue, type VisibilitySubject } from "@/lib/match/queueVisibility";
import { AGE_BANDS } from "@/lib/domain/enums";
import { prisma } from "@/lib/db";
import { seedDatabase, FRIEND_QUEUES } from "@/lib/seed/seed";
import { joinFriendQueue, listFriendQueues, setQueueVisibility, whyForFriendQueue } from "@/lib/server/friendQueues";
import { joinQueue, leaveQueue, tick } from "@/lib/server/queue";
import { listNotifications } from "@/lib/server/notifications";
import { setSetting } from "@/lib/server/settings";
import { whyTemplate } from "@/lib/agents/friendQueueWhy";

const subj = (id: string, o: Partial<VisibilitySubject> = {}): VisibilitySubject => ({
  id,
  ageBand: "18-24",
  gender: "man",
  womenOnlyParty: false,
  blocked: new Set(),
  queueVisibility: "friends",
  ...o,
});

describe("canSeeQueue (pure)", () => {
  it("needs friendship and the owner's opt-in; the viewer's own setting doesn't matter", () => {
    const v = subj("v", { queueVisibility: "off" });
    expect(canSeeQueue(v, subj("o"), true)).toBe(true);
    expect(canSeeQueue(v, subj("o"), false)).toBe(false);
    expect(canSeeQueue(v, subj("o", { queueVisibility: "off" }), true)).toBe(false);
    expect(canSeeQueue(v, subj("o"), true, false)).toBe(false); // this queue was private
    expect(canSeeQueue(v, v, true)).toBe(false);
  });

  it("hides on a block either way, across age bands, and women-only queues from non-women", () => {
    expect(canSeeQueue(subj("v", { blocked: new Set(["o"]) }), subj("o"), true)).toBe(false);
    expect(canSeeQueue(subj("v"), subj("o", { blocked: new Set(["v"]) }), true)).toBe(false);
    expect(canSeeQueue(subj("v", { ageBand: "16-17" }), subj("o"), true)).toBe(false);
    expect(canSeeQueue(subj("v", { ageBand: "25+" }), subj("o"), true)).toBe(true); // all adults are one group
    const wo = subj("o", { gender: "woman", womenOnlyParty: true });
    expect(canSeeQueue(subj("v", { gender: "man" }), wo, true)).toBe(false);
    expect(canSeeQueue(subj("v", { gender: "woman" }), wo, true)).toBe(true);
  });

  it("property: anything visible is to a friend who opted in, unblocked, same band", () => {
    const arb = fc.record({
      vb: fc.constantFrom(...AGE_BANDS), ob: fc.constantFrom(...AGE_BANDS),
      vis: fc.constantFrom("off", "friends"), friends: fc.boolean(), entry: fc.boolean(),
      blockV: fc.boolean(), blockO: fc.boolean(), wo: fc.boolean(),
      vg: fc.constantFrom("woman", "man", "nonbinary"), og: fc.constantFrom("woman", "man", "nonbinary"),
    });
    fc.assert(
      fc.property(arb, (w) => {
        const v = subj("v", { ageBand: w.vb, gender: w.vg, blocked: new Set(w.blockV ? ["o"] : []) });
        const o = subj("o", { ageBand: w.ob, gender: w.og, queueVisibility: w.vis, womenOnlyParty: w.wo, blocked: new Set(w.blockO ? ["v"] : []) });
        if (canSeeQueue(v, o, w.friends, w.entry)) {
          expect(w.friends && w.entry && w.vis === "friends" && !w.blockV && !w.blockO && w.vb === w.ob).toBe(true);
          if (w.wo) expect(w.vg).toBe("woman");
        }
      }),
    );
  });

  it("canJoinFriendQueue explains why not", () => {
    expect(canJoinFriendQueue(subj("v"), subj("o"))).toEqual({ ok: true });
    expect(canJoinFriendQueue(subj("v"), subj("o", { womenOnlyParty: true, gender: "woman" }))).toEqual({ ok: false, reason: "women_only" });
  });
});

describe("friends' queues (DB)", () => {
  beforeEach(async () => {
    await seedDatabase(prisma, { now: new Date(2026, 10, 12, 9) });
    await setSetting("simFillMs", "0");
  });

  it("Jordan sees the three friends who share, not the one queuing privately; nobody else sees them", async () => {
    const qs = await listFriendQueues("p01");
    expect(qs.map((q) => q.friend.id).sort()).toEqual(["p02", "p04", "p45"]);
    expect(FRIEND_QUEUES.find((f) => f.userId === "p50")!.visible).toBe(false);
    const reza = qs.find((q) => q.friend.id === "p04")!;
    expect(reza).toMatchObject({ state: "waiting", canJoin: true, label: "Queuing for Indie Night: Local Bands Showcase", area: "Menlo Park Caltrain" });
    // a hangout never reveals more than "a new hangout"
    expect(qs.find((q) => q.friend.id === "p45")).toMatchObject({ event: null, label: "Queuing to plan a new hangout" });
    // the response carries only what the card shows: no lat/lng, no other queuers
    expect(JSON.stringify(qs)).not.toMatch(/lat|lng|isSimulated/);
    // a non-friend of Reza sees nothing
    const strangers = await prisma.user.findMany({ where: { id: { notIn: ["p01", "p02", "p04", "p45", "p50"] } }, select: { id: true }, take: 5 });
    for (const s of strangers) {
      const theirs = await listFriendQueues(s.id);
      const fr = await prisma.friendship.count({ where: { OR: [{ userAId: s.id, userBId: "p04" }, { userAId: "p04", userBId: s.id }] } });
      if (!fr) expect(theirs.find((q) => q.friend.id === "p04")).toBeUndefined();
    }
  });

  it("narrows to one event, and turning sharing off hides it at once", async () => {
    expect((await listFriendQueues("p01", { eventId: "ev-indie-guild" })).map((q) => q.friend.id)).toEqual(["p04"]);
    await setQueueVisibility("p04", "off");
    expect(await listFriendQueues("p01", { eventId: "ev-indie-guild" })).toEqual([]);
  });

  it("a block hides it", async () => {
    await prisma.block.create({ data: { blockerId: "p04", blockedId: "p01" } });
    expect((await listFriendQueues("p01")).map((q) => q.friend.id)).not.toContain("p04");
  });

  it("parked friends don't match each other until a real person joins that queue", async () => {
    expect(await tick()).toBe(0);
    expect(await prisma.queueEntry.count({ where: { parked: true } })).toBe(FRIEND_QUEUES.length);
  });

  it("Queue up too joins the same queue, un-parks the friend and records who brought you", async () => {
    const reza = (await listFriendQueues("p01")).find((q) => q.friend.id === "p04")!;
    const r = await joinFriendQueue("p01", reza.entryId);
    expect(r.ok).toBe(true);
    const mine = await prisma.queueEntry.findFirstOrThrow({ where: { userId: "p01", status: "waiting" } });
    expect(mine).toMatchObject({ eventId: "ev-indie-guild", bucketLandmarkId: "lm-menlo-caltrain", targetPartySize: 5, viaFriendId: "p04", visibleToFriends: false });
    expect((await prisma.queueEntry.findUniqueOrThrow({ where: { id: reza.entryId } })).parked).toBe(false);
    // Jordan's sharing stays off (the default) unless they turn it on
    expect((await prisma.user.findUniqueOrThrow({ where: { id: "p01" } })).queueVisibility).toBe("off");
  });

  it("you can't join a queue you can't see", async () => {
    const oscar = await prisma.queueEntry.findFirstOrThrow({ where: { userId: "p50" } });
    expect(await joinFriendQueue("p01", oscar.id)).toMatchObject({ ok: false, error: "not_visible" });
  });

  it("the queue setup choice is saved, and friends see your queue only when you share it", async () => {
    await joinQueue("p01", { eventId: "ev-indie-guild", targetSize: 5, landmarkId: "lm-downtown-pa", locationSource: "manual", visibleToFriends: true });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: "p01" } })).queueVisibility).toBe("friends");
    expect((await listFriendQueues("p04")).map((q) => q.friend.id)).toContain("p01");
    await leaveQueue("p01");
    await joinQueue("p01", { eventId: "ev-indie-guild", targetSize: 5, landmarkId: "lm-downtown-pa", locationSource: "manual", visibleToFriends: false });
    expect((await listFriendQueues("p04")).map((q) => q.friend.id)).not.toContain("p01");
  });

  it("notifications include friends who are queuing", async () => {
    const n = await listNotifications("p01", new Date(2026, 10, 12, 9));
    expect(n.filter((x) => x.kind === "friend_queue").map((x) => x.bold).sort()).toEqual(["Ari Moreau", "Freya Rossi", "Reza Ali"]);
  });

  it("the why line falls back to a grounded template offline", async () => {
    const reza = (await listFriendQueues("p01")).find((q) => q.friend.id === "p04")!;
    const w = await whyForFriendQueue("p01", reza.entryId);
    expect(w?.line).toMatch(/Reza/);
    expect(await whyForFriendQueue("p01", "nope")).toBeNull();
    expect(whyTemplate({ friendFirstName: "Reza", sharedTags: [], event: null, mode: "hangout" })).toMatch(/^You and Reza are friends/);
  });
});
