import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { seedDatabase } from "@/lib/seed/seed";
import { getQueueStatus, joinQueue, tick } from "@/lib/server/queue";
import { setSetting } from "@/lib/server/settings";
import { acceptParty, declineParty, sweepReadyChecks, DEFAULT_ACCEPT_WINDOW_MS } from "@/lib/server/readyCheck";
import { getBadges, markTabSeen } from "@/lib/server/badges";
import { squadEventIds } from "@/lib/server/squads";
import { nowMs } from "@/lib/clock";
import { getPartyForUser } from "@/lib/server/party";
import { getStatusCard } from "@/lib/server/status";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Jordan (p01, the only real person) queues and the simulated room fills; one tick proposes a squad. */
async function proposeSquad(size = 4, mode: "events" | "hangout" = "events") {
  await joinQueue("p01", { mode, eventId: mode === "events" ? "ev-indie-guild" : null, targetSize: size, landmarkId: "lm-downtown-pa", locationSource: "manual" });
  await wait(300);
  expect(await tick()).toBe(1);
  return prisma.party.findFirstOrThrow({ where: { status: "confirming" }, include: { members: { include: { user: true } }, chat: true, event: true } });
}

describe("ready check (\"I'm in\")", () => {
  beforeEach(async () => {
    await seedDatabase(prisma, { now: new Date() });
    await setSetting("simFillMs", "0");
    await markTabSeen("p01", "chats");
  });

  it("a found squad waits for real members: simulated ones are already in, no chat yet, nothing on the event", async () => {
    const party = await proposeSquad();
    expect(party.eventId).toBe("ev-indie-guild");
    expect(party.acceptBy!.getTime()).toBeGreaterThan(nowMs() + DEFAULT_ACCEPT_WINDOW_MS - 5_000);
    for (const m of party.members) expect(Boolean(m.acceptedAt)).toBe(m.user.isSimulated);
    expect(party.chat).toBeNull();
    expect(await prisma.chatMessage.count({ where: { chat: { partyId: party.id } } })).toBe(0);
    expect(await prisma.talkCard.count({ where: { partyId: party.id } })).toBe(0);
    expect((await getBadges("p01")).chats).toBe(0);
    expect((await squadEventIds("p01")).size).toBe(0); // no "Your squad is going" until it's confirmed
    expect(await getQueueStatus("p01")).toMatchObject({ state: "matched", partyId: party.id });
  });

  it("\"I'm in\" from the last real member confirms the squad and opens the chat with the host", async () => {
    const party = await proposeSquad();
    expect(await acceptParty("p01", party.id)).toEqual({ ok: true, status: "confirmed" });
    const done = await prisma.party.findUniqueOrThrow({ where: { id: party.id }, include: { chat: true, members: true } });
    expect(done.status).toBe("confirmed");
    expect(done.acceptBy).toBeNull();
    expect(done.members.every((m) => m.acceptedAt)).toBe(true);
    expect(done.chat?.type).toBe("squad");
    expect(await prisma.chatMessage.count({ where: { chatId: done.chat!.id, kind: "host" } })).toBeGreaterThan(0);
    expect(await prisma.talkCard.count({ where: { partyId: party.id } })).toBeGreaterThan(0);
    expect((await getBadges("p01")).chats).toBe(1);
    // tapping again is harmless and doesn't make a second chat
    expect(await acceptParty("p01", party.id)).toEqual({ ok: true, status: "confirmed" });
    expect(await prisma.chat.count({ where: { partyId: party.id } })).toBe(1);
  });

  it("with two real people, the squad stays in the ready check until both are in", async () => {
    await setSetting("fillMode", "live");
    await prisma.user.update({ where: { id: "p02" }, data: { isSimulated: false, isLive: true } });
    for (const u of ["p01", "p02"]) await joinQueue(u, { eventId: "ev-indie-guild", targetSize: 2, landmarkId: "lm-downtown-pa", locationSource: "manual" });
    expect(await tick()).toBe(1);
    const party = await prisma.party.findFirstOrThrow({ where: { status: "confirming" } });
    expect(await acceptParty("p02", party.id)).toEqual({ ok: true, status: "confirming" });
    expect(await prisma.chat.count({ where: { partyId: party.id } })).toBe(0);
    expect(await acceptParty("p01", party.id)).toEqual({ ok: true, status: "confirmed" });
    expect(await prisma.chat.count({ where: { partyId: party.id } })).toBe(1);
  });

  it("\"Not for me\": the decliner leaves the queue, the others go back in line with their original join time", async () => {
    await setSetting("fillMode", "live");
    for (const u of ["p02", "p03"]) await prisma.user.update({ where: { id: u }, data: { isSimulated: false, isLive: true } });
    for (const u of ["p01", "p02", "p03"]) await joinQueue(u, { eventId: "ev-indie-guild", targetSize: 3, landmarkId: "lm-downtown-pa", locationSource: "manual" });
    const joined = new Map((await prisma.queueEntry.findMany({ where: { status: "waiting" } })).map((e) => [e.userId, e.joinedAt.getTime()]));
    expect(await tick()).toBe(1);
    const party = await prisma.party.findFirstOrThrow({ where: { status: "confirming" } });
    await acceptParty("p02", party.id);

    expect(await declineParty("p01", party.id)).toEqual({ ok: true, status: "cancelled" });
    expect((await prisma.party.findUniqueOrThrow({ where: { id: party.id } })).status).toBe("cancelled");
    expect(await prisma.chat.count({ where: { partyId: party.id } })).toBe(0);
    expect((await getQueueStatus("p01")).state).toBe("idle");
    for (const u of ["p02", "p03"]) {
      const s = await getQueueStatus(u);
      expect(s.state).toBe("waiting");
      const e = await prisma.queueEntry.findUniqueOrThrow({ where: { id: s.entryId! } });
      expect(e.joinedAt.getTime()).toBe(joined.get(u)); // kept their place in line
      expect(e.partyId).toBeNull();
    }
    // too late to change your mind on a dissolved squad
    expect(await acceptParty("p03", party.id)).toMatchObject({ ok: false, error: "closed" });
    // the two who are left can still be matched again (no cooldown), here with a fresh third person
    await prisma.user.update({ where: { id: "p04" }, data: { isSimulated: false, isLive: true } });
    await joinQueue("p04", { eventId: "ev-indie-guild", targetSize: 3, landmarkId: "lm-downtown-pa", locationSource: "manual" });
    expect(await tick()).toBe(1);
    const next = await prisma.party.findFirstOrThrow({ where: { status: "confirming" }, include: { members: true } });
    expect(next.members.map((m) => m.userId).sort()).toEqual(["p02", "p03", "p04"]);
  });

  it("declining with simulated squadmates: the fillers leave too, and a hangout planned for the squad is dropped", async () => {
    const party = await proposeSquad(4, "hangout");
    expect(party.event!.kind).toBe("hangout");
    await declineParty("p01", party.id);
    expect(await prisma.event.findUnique({ where: { id: party.event!.id } })).toBeNull();
    expect(await prisma.queueEntry.count({ where: { partyId: party.id, status: { not: "left" } } })).toBe(0);
    expect(await prisma.queueEntry.count({ where: { status: "waiting", parked: false } })).toBe(0); // parked = seeded friends' demo entries
  });

  it("times out: whoever didn't answer is dropped, the ones who said yes are re-queued", async () => {
    await setSetting("fillMode", "live");
    await prisma.user.update({ where: { id: "p02" }, data: { isSimulated: false, isLive: true } });
    for (const u of ["p01", "p02"]) await joinQueue(u, { eventId: "ev-indie-guild", targetSize: 2, landmarkId: "lm-downtown-pa", locationSource: "manual" });
    expect(await tick()).toBe(1);
    const party = await prisma.party.findFirstOrThrow({ where: { status: "confirming" } });
    await acceptParty("p02", party.id);
    expect(await sweepReadyChecks()).toEqual([]); // not due yet
    expect(await sweepReadyChecks(party.acceptBy!.getTime() + 1)).toEqual([party.id]);
    expect((await prisma.party.findUniqueOrThrow({ where: { id: party.id } })).status).toBe("cancelled");
    expect((await getQueueStatus("p01")).state).toBe("idle");
    expect((await getQueueStatus("p02")).state).toBe("waiting");
  });

  it("a late \"I'm in\" after the deadline is refused and settles the check", async () => {
    await setSetting("acceptWindowMs", "1");
    const party = await proposeSquad();
    await wait(10);
    expect(await acceptParty("p01", party.id)).toEqual({ ok: false, error: "expired" });
    expect((await prisma.party.findUniqueOrThrow({ where: { id: party.id } })).status).toBe("cancelled");
  });

  it("before everyone's in, the server reveals only first name + last initial and shared interests: no photo, no rationale", async () => {
    const party = await proposeSquad();
    expect(party.rationale).toBeTruthy(); // stored, just not shown yet
    const masked = (await getPartyForUser("p01", party.id))!;
    expect(masked.status).toBe("confirming");
    expect(masked.rationale).toBeNull();
    for (const m of masked.members) {
      const real = party.members.find((x) => x.userId === m.userId)!.user.name;
      expect(m.photoUrl).toBeNull();
      if (m.userId === "p01") expect(m.user.name).toBe(real);
      else {
        expect(m.user.name).toMatch(/^\S+ [A-Z]\.$/);
        expect(m.user.name).not.toBe(real);
        expect(real.startsWith(m.user.name.split(" ")[0])).toBe(true);
        expect(m.shared!.length).toBeLessThanOrEqual(3);
      }
    }
    expect(masked.members.some((m) => m.shared!.length > 0)).toBe(true);
    // the Events tab card asks the one question
    expect(await getStatusCard("p01", new Date(nowMs()))).toMatchObject({ state: "accept", partyId: party.id, accepted: false, action: { href: "/queue" } });
    await acceptParty("p01", party.id);
    const open = (await getPartyForUser("p01", party.id))!;
    expect(open.rationale).toBeTruthy();
    expect(open.members.map((m) => m.user.name).sort()).toEqual(party.members.map((m) => m.user.name).sort());
    expect((await getStatusCard("p01", new Date(nowMs())))?.state).toBe("ready");
  });

  it("outsiders can't answer someone else's ready check", async () => {
    const party = await proposeSquad();
    const outsider = (await prisma.user.findFirstOrThrow({ where: { id: { notIn: party.members.map((m) => m.userId) } } })).id;
    expect(await acceptParty(outsider, party.id)).toEqual({ ok: false, error: "not_found" });
    expect(await declineParty(outsider, party.id)).toEqual({ ok: false, error: "not_found" });
    expect((await prisma.party.findUniqueOrThrow({ where: { id: party.id } })).status).toBe("confirming");
  });
});
