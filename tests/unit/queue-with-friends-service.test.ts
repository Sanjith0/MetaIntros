import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { seedDatabase } from "@/lib/seed/seed";
import { getQueueStatus, leaveQueue, tick } from "@/lib/server/queue";
import { setSetting } from "@/lib/server/settings";
import { declineParty } from "@/lib/server/readyCheck";
import { tickAndAccept } from "../helpers/squad";
import {
  askToJoin, cancelGroup, createGroup, friendsForQueue, getGroupView, pendingInvites, respondToInvite, startGroup,
} from "@/lib/server/queueGroups";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const settings = (targetSize = 5) => ({ eventId: "ev-indie-guild", targetSize, landmarkId: "lm-downtown-pa", locationSource: "manual" as const });

/** Jordan (p01, 18–24) has friends p20 and p30 (18–24) and p66 (25+), none in the seeded friend queues; p02 is already queuing. Simulated friends accept on their own. */
describe("queue with friends (DB)", () => {
  beforeEach(async () => {
    await seedDatabase(prisma, { now: new Date(2026, 10, 12, 9) });
    await setSetting("simFillMs", "0");
  });

  it("lists friends with a reason for anyone who can't come", async () => {
    const list = await friendsForQueue("p01");
    expect(list.find((f) => f.id === "p20")!.blocker).toBeNull();
    expect(list.find((f) => f.id === "p66")!.blocker).toBeNull(); // 25+ with 18–24: all adults are one group
    expect(list.find((f) => f.id === "p02")!.blocker).toBe("busy");
  });

  it("rejects non-friends and a group with no slot left for someone new; adults of any age can come", async () => {
    expect(await createGroup("p01", settings(), ["p03"])).toMatchObject({ ok: false, error: "not_friends" });
    expect(await createGroup("p01", settings(), ["p20", "p66"])).toMatchObject({ ok: true });
    expect(await createGroup("p01", settings(4), ["p20", "p30", "p50"])).toMatchObject({ ok: false, error: "too_many" });
  });

  it("invites, friends join, the host starts, and the squad holds every friend", async () => {
    const r = await createGroup("p01", settings(5), ["p20", "p30"]);
    expect(r.ok).toBe(true);
    const groupId = (r as { groupId: string }).groupId;
    // simulated friends said yes on their own (inline in tests)
    const view = await getGroupView("p01", groupId);
    expect(view!.members.map((m) => m.status).sort()).toEqual(["host", "in", "in"]);
    expect(await getGroupView("p03", groupId)).toBeNull(); // not a member: nothing to see

    expect(await startGroup("p01", groupId)).toMatchObject({ ok: true });
    const entries = await prisma.queueEntry.findMany({ where: { groupId, status: "waiting" } });
    expect(entries.map((e) => e.userId).sort()).toEqual(["p01", "p20", "p30"]);
    expect(new Set(entries.map((e) => e.joinedAt.getTime())).size).toBe(1);

    const s = await getQueueStatus("p01");
    expect(s.friends!.map((f) => f.id).sort()).toEqual(["p20", "p30"]);
    await wait(300);
    // Every newcomer has to fit both friends, so this squad forms once the search has widened
    // (about 30s of waiting in the seeded world): wind the shared join time back instead of sleeping.
    await prisma.queueEntry.updateMany({ where: { status: "waiting", parked: false }, data: { joinedAt: new Date(Date.now() - 31_000) } });
    expect(await tickAndAccept()).toBe(1);
    const done = await getQueueStatus("p01");
    expect(done.state).toBe("matched");
    const members = await prisma.partyMember.findMany({ where: { partyId: done.partyId! } });
    expect(members).toHaveLength(5);
    expect(members.filter((m) => m.groupId === groupId).map((m) => m.userId).sort()).toEqual(["p01", "p20", "p30"]);
    expect(members.filter((m) => m.groupId === null)).toHaveLength(2);

    // talk cards and pre-chats only between people who didn't come together
    const cards = await prisma.talkCard.findMany({ where: { partyId: done.partyId! } });
    expect(cards.some((c) => ["p01", "p20", "p30"].includes(c.ownerId) && ["p01", "p20", "p30"].includes(c.subjectId))).toBe(false);
    expect(cards).toHaveLength(5 * 4 - 3 * 2);
    expect(await prisma.preChat.count({ where: { partyId: done.partyId! } })).toBe(10 - 3);
    // the AI host names who came together and pulls the new people in (template line)
    const chat = await prisma.chat.findUniqueOrThrow({ where: { partyId: done.partyId! } });
    const host = await prisma.chatMessage.findMany({ where: { chatId: chat.id, kind: "host" } });
    expect(host.some((m) => m.body.includes("came together") && m.body.includes("new faces"))).toBe(true);
    // the formation trace says the friends were kept together
    const step = await prisma.agentTrace.findFirst({ where: { partyId: done.partyId!, toolName: "keepFriendsTogether" } });
    expect(step?.summary).toMatch(/Kept .* together/);
  });

  it("a real friend gets an invite and can say no", async () => {
    await prisma.user.update({ where: { id: "p20" }, data: { isSimulated: false } });
    const { groupId } = (await createGroup("p01", settings(), ["p20"])) as { groupId: string };
    expect((await pendingInvites("p20")).map((i) => i.groupId)).toEqual([groupId]);
    expect(await startGroup("p01", groupId)).toMatchObject({ ok: false, error: "no_friends" });
    expect(await respondToInvite("p20", groupId, false)).toMatchObject({ ok: true });
    expect(await pendingInvites("p20")).toHaveLength(0);
  });

  it("friends who haven't answered are left out when the host starts", async () => {
    await prisma.user.update({ where: { id: "p30" }, data: { isSimulated: false } });
    const { groupId } = (await createGroup("p01", settings(), ["p20", "p30"])) as { groupId: string };
    await startGroup("p01", groupId);
    expect((await getGroupView("p30", groupId))!.mySeat).toBe("missed");
    expect(await respondToInvite("p30", groupId, true)).toMatchObject({ ok: false, error: "closed" });
  });

  it("a friend of the host can ask to come along while the host is waiting", async () => {
    await prisma.user.update({ where: { id: "p20" }, data: { isSimulated: false } });
    const { groupId } = (await createGroup("p01", settings(), ["p20"])) as { groupId: string };
    expect(await askToJoin("p30", groupId)).toMatchObject({ ok: true });
    expect(await askToJoin("p03", groupId)).toMatchObject({ ok: false, error: "not_friends" });
    expect(await askToJoin("p02", groupId)).toMatchObject({ ok: false, error: "blocked", blocker: "busy" });
  });

  it("leaving the queue drops only you; your friends keep queuing together", async () => {
    await setSetting("fillMode", "live");
    const { groupId } = (await createGroup("p01", settings(), ["p20", "p30"])) as { groupId: string };
    await startGroup("p01", groupId);
    await leaveQueue("p20");
    const left = await prisma.queueEntry.findMany({ where: { groupId, status: "waiting" } });
    expect(left.map((e) => e.userId).sort()).toEqual(["p01", "p30"]);
  });

  it("if a newcomer passes on the ready check, the friends go back into the queue together", async () => {
    const { groupId } = (await createGroup("p01", settings(5), ["p20", "p30"])) as { groupId: string };
    await startGroup("p01", groupId);
    const joined = (await prisma.queueEntry.findFirstOrThrow({ where: { userId: "p01", groupId } })).joinedAt;
    await wait(300);
    await prisma.queueEntry.updateMany({ where: { status: "waiting", parked: false }, data: { joinedAt: new Date(Date.now() - 31_000) } });
    expect(await tick()).toBe(1);
    const { partyId } = await getQueueStatus("p01");
    const newcomer = (await prisma.partyMember.findFirstOrThrow({ where: { partyId: partyId!, groupId: null } })).userId;
    await prisma.user.update({ where: { id: newcomer }, data: { isSimulated: false } });
    expect(await declineParty(newcomer, partyId!)).toMatchObject({ ok: true, status: "cancelled" });
    const back = await prisma.queueEntry.findMany({ where: { groupId, status: "waiting" } });
    expect(back.map((e) => e.userId).sort()).toEqual(["p01", "p20", "p30"]);
    expect(new Set(back.map((e) => e.joinedAt.getTime())).size).toBe(1);
    expect(back[0].joinedAt.getTime()).toBeLessThan(joined.getTime());
    expect(await prisma.queueEntry.count({ where: { userId: newcomer, status: "waiting" } })).toBe(0);
  });

  it("a friend who passes stays out; the rest of the friends go back together", async () => {
    const { groupId } = (await createGroup("p01", settings(5), ["p20", "p30"])) as { groupId: string };
    await startGroup("p01", groupId);
    await wait(300);
    await prisma.queueEntry.updateMany({ where: { status: "waiting", parked: false }, data: { joinedAt: new Date(Date.now() - 31_000) } });
    expect(await tick()).toBe(1);
    const { partyId } = await getQueueStatus("p01");
    await prisma.user.update({ where: { id: "p20" }, data: { isSimulated: false } });
    await declineParty("p20", partyId!);
    const back = await prisma.queueEntry.findMany({ where: { groupId, status: "waiting" } });
    expect(back.map((e) => e.userId).sort()).toEqual(["p01", "p30"]);
  });

  it("the host can cancel before queuing", async () => {
    await prisma.user.update({ where: { id: "p20" }, data: { isSimulated: false } });
    const { groupId } = (await createGroup("p01", settings(), ["p20"])) as { groupId: string };
    expect(await cancelGroup("p01", groupId)).toMatchObject({ ok: true });
    expect(await pendingInvites("p20")).toHaveLength(0);
  });
});
