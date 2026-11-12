import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { seedDatabase } from "@/lib/seed/seed";
import { getQueueStatus, leaveQueue, tick } from "@/lib/server/queue";
import { setSetting } from "@/lib/server/settings";
import {
  askToJoin, cancelGroup, createGroup, friendsForQueue, getGroupView, pendingInvites, respondToInvite, startGroup,
} from "@/lib/server/queueGroups";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const settings = (targetSize = 5) => ({ eventId: "ev-indie-guild", targetSize, landmarkId: "lm-downtown-pa", locationSource: "manual" as const });

/** Jordan (p01, 18–24) has friends p02 and p04 (18–24) and p66 (25+). Simulated friends accept on their own. */
describe("queue with friends (DB)", () => {
  beforeEach(async () => {
    await seedDatabase(prisma, { now: new Date(2026, 10, 12, 9) });
    await setSetting("simFillMs", "0");
  });

  it("lists friends with a reason for anyone who can't come", async () => {
    const list = await friendsForQueue("p01");
    expect(list.find((f) => f.id === "p02")!.blocker).toBeNull();
    expect(list.find((f) => f.id === "p66")!.blocker).toBe("age_band");
  });

  it("rejects non-friends, other age bands, and a group with no slot left for someone new", async () => {
    expect(await createGroup("p01", settings(), ["p03"])).toMatchObject({ ok: false, error: "not_friends" });
    expect(await createGroup("p01", settings(), ["p02", "p66"])).toMatchObject({ ok: false, error: "friend_blocked", friendId: "p66", blocker: "age_band" });
    expect(await createGroup("p01", settings(4), ["p02", "p04", "p20"])).toMatchObject({ ok: false, error: "too_many" });
  });

  it("invites, friends join, the host starts, and the squad holds every friend", async () => {
    const r = await createGroup("p01", settings(5), ["p02", "p04"]);
    expect(r.ok).toBe(true);
    const groupId = (r as { groupId: string }).groupId;
    // simulated friends said yes on their own (inline in tests)
    const view = await getGroupView("p01", groupId);
    expect(view!.members.map((m) => m.status).sort()).toEqual(["host", "in", "in"]);
    expect(await getGroupView("p03", groupId)).toBeNull(); // not a member: nothing to see

    expect(await startGroup("p01", groupId)).toMatchObject({ ok: true });
    const entries = await prisma.queueEntry.findMany({ where: { groupId, status: "waiting" } });
    expect(entries.map((e) => e.userId).sort()).toEqual(["p01", "p02", "p04"]);
    expect(new Set(entries.map((e) => e.joinedAt.getTime())).size).toBe(1);

    const s = await getQueueStatus("p01");
    expect(s.friends!.map((f) => f.id).sort()).toEqual(["p02", "p04"]);
    await wait(300);
    expect(await tick()).toBe(1);
    const done = await getQueueStatus("p01");
    expect(done.state).toBe("matched");
    const members = await prisma.partyMember.findMany({ where: { partyId: done.partyId! } });
    expect(members).toHaveLength(5);
    expect(members.filter((m) => m.groupId === groupId).map((m) => m.userId).sort()).toEqual(["p01", "p02", "p04"]);
    expect(members.filter((m) => m.groupId === null)).toHaveLength(2);

    // talk cards and pre-chats only between people who didn't come together
    const cards = await prisma.talkCard.findMany({ where: { partyId: done.partyId! } });
    expect(cards.some((c) => ["p01", "p02", "p04"].includes(c.ownerId) && ["p01", "p02", "p04"].includes(c.subjectId))).toBe(false);
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
    await prisma.user.update({ where: { id: "p02" }, data: { isSimulated: false } });
    const { groupId } = (await createGroup("p01", settings(), ["p02"])) as { groupId: string };
    expect((await pendingInvites("p02")).map((i) => i.groupId)).toEqual([groupId]);
    expect(await startGroup("p01", groupId)).toMatchObject({ ok: false, error: "no_friends" });
    expect(await respondToInvite("p02", groupId, false)).toMatchObject({ ok: true });
    expect(await pendingInvites("p02")).toHaveLength(0);
  });

  it("friends who haven't answered are left out when the host starts", async () => {
    await prisma.user.update({ where: { id: "p04" }, data: { isSimulated: false } });
    const { groupId } = (await createGroup("p01", settings(), ["p02", "p04"])) as { groupId: string };
    await startGroup("p01", groupId);
    expect((await getGroupView("p04", groupId))!.mySeat).toBe("missed");
    expect(await respondToInvite("p04", groupId, true)).toMatchObject({ ok: false, error: "closed" });
  });

  it("a friend of the host can ask to come along while the host is waiting", async () => {
    await prisma.user.update({ where: { id: "p02" }, data: { isSimulated: false } });
    const { groupId } = (await createGroup("p01", settings(), ["p02"])) as { groupId: string };
    expect(await askToJoin("p04", groupId)).toMatchObject({ ok: true });
    expect(await askToJoin("p03", groupId)).toMatchObject({ ok: false, error: "not_friends" });
    expect(await askToJoin("p66", groupId)).toMatchObject({ ok: false, error: "blocked", blocker: "age_band" });
  });

  it("leaving the queue drops only you; your friends keep queuing together", async () => {
    await setSetting("fillMode", "live");
    const { groupId } = (await createGroup("p01", settings(), ["p02", "p04"])) as { groupId: string };
    await startGroup("p01", groupId);
    await leaveQueue("p02");
    const left = await prisma.queueEntry.findMany({ where: { groupId, status: "waiting" } });
    expect(left.map((e) => e.userId).sort()).toEqual(["p01", "p04"]);
  });

  it("the host can cancel before queuing", async () => {
    await prisma.user.update({ where: { id: "p02" }, data: { isSimulated: false } });
    const { groupId } = (await createGroup("p01", settings(), ["p02"])) as { groupId: string };
    expect(await cancelGroup("p01", groupId)).toMatchObject({ ok: true });
    expect(await pendingInvites("p02")).toHaveLength(0);
  });
});
