import { beforeEach, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { prisma } from "@/lib/db";
import { makeEvent, makeLandmark, makeParty, makeUser, resetDb } from "../helpers/db";
import { AgeBand, ageBandFor, ChatType, FriendshipSource, normalizePair, PartySize } from "@/lib/domain/enums";

beforeEach(resetDb);

describe("migrations", () => {
  it("are fully applied with no drift", () => {
    const out = execSync("pnpm exec prisma migrate status", {
      env: { ...process.env, DATABASE_URL: "file:./test.db" },
    }).toString();
    expect(out).toMatch(/Database schema is up to date/);
  });
});

describe("CRUD per model", () => {
  it("User (ageBand + safety prefs + live flags)", async () => {
    const u = await makeUser({ ageBand: "16-17", gender: "woman", womenOnlyParty: true, isLive: true, isSimulated: false });
    expect((await prisma.user.findUnique({ where: { id: u.id } }))?.womenOnlyParty).toBe(true);
    const up = await prisma.user.update({ where: { id: u.id }, data: { locationSource: "gps", homeLat: 37.4, homeLng: -122.1 } });
    expect(up.locationSource).toBe("gps");
    await prisma.user.delete({ where: { id: u.id } });
    expect(await prisma.user.count()).toBe(0);
  });

  it("TasteProfile (one per user, JSON fields round-trip)", async () => {
    const u = await makeUser();
    const tp = await prisma.tasteProfile.create({
      data: {
        userId: u.id,
        likes: [{ name: "Climbing", category: "Sport", source: "likes[0]" }],
        dislikes: [{ name: "EDM", category: "Music", source: "negative_feedback[0]" }],
        groups: [], music: [], eventHistory: [],
        interestTags: ["climbing"], embedding: [0.1, 0.2], socialStyle: "small-group",
      },
    });
    const read = await prisma.tasteProfile.findUnique({ where: { userId: u.id } });
    expect(read?.embedding).toEqual([0.1, 0.2]);
    await prisma.tasteProfile.update({ where: { id: tp.id }, data: { socialStyle: "active" } });
    await expect(
      prisma.tasteProfile.create({ data: { ...tp, id: undefined, likes: [], dislikes: [], groups: [], music: [], eventHistory: [], interestTags: [], embedding: [] } }),
    ).rejects.toThrow();
    await prisma.tasteProfile.delete({ where: { id: tp.id } });
  });

  it("Availability", async () => {
    const u = await makeUser();
    const a = await prisma.availability.create({ data: { userId: u.id, dayOfWeek: 6, startMin: 600, endMin: 1080 } });
    await prisma.availability.update({ where: { id: a.id }, data: { endMin: 1200 } });
    expect((await prisma.availability.findMany({ where: { userId: u.id } }))[0].endMin).toBe(1200);
    await prisma.availability.delete({ where: { id: a.id } });
  });

  it("Friendship (source + met-at event, unique normalized pair)", async () => {
    const [a, b] = await Promise.all([makeUser(), makeUser()]);
    const ev = await makeEvent();
    const [x, y] = normalizePair(a.id, b.id);
    const f = await prisma.friendship.create({ data: { userAId: x, userBId: y, source: "queue_up", metAtEventId: ev.id, sharedNote: "climbing" } });
    expect((await prisma.friendship.findUnique({ where: { id: f.id }, include: { metAtEvent: true } }))?.metAtEvent?.title).toBe("Indie Night");
    await expect(prisma.friendship.create({ data: { userAId: x, userBId: y } })).rejects.toThrow();
    await prisma.friendship.update({ where: { id: f.id }, data: { source: "existing" } });
    await prisma.friendship.delete({ where: { id: f.id } });
  });

  it("FriendRequest", async () => {
    const [a, b] = await Promise.all([makeUser(), makeUser()]);
    const r = await prisma.friendRequest.create({ data: { fromId: a.id, toId: b.id } });
    expect(r.status).toBe("pending");
    await prisma.friendRequest.update({ where: { id: r.id }, data: { status: "accepted" } });
    await expect(prisma.friendRequest.create({ data: { fromId: a.id, toId: b.id } })).rejects.toThrow();
    await prisma.friendRequest.delete({ where: { id: r.id } });
  });

  it("Block", async () => {
    const [a, b] = await Promise.all([makeUser(), makeUser()]);
    const blk = await prisma.block.create({ data: { blockerId: a.id, blockedId: b.id } });
    expect(await prisma.block.count({ where: { blockedId: b.id } })).toBe(1);
    await expect(prisma.block.create({ data: { blockerId: a.id, blockedId: b.id } })).rejects.toThrow();
    await prisma.block.delete({ where: { id: blk.id } });
  });

  it("Landmark", async () => {
    const lm = await makeLandmark();
    await prisma.landmark.update({ where: { id: lm.id }, data: { description: "Big lawn" } });
    expect((await prisma.landmark.findUnique({ where: { id: lm.id } }))?.description).toBe("Big lawn");
    await prisma.landmark.delete({ where: { id: lm.id } });
  });

  it("Event + EventRsvp", async () => {
    const lm = await makeLandmark();
    const ev = await makeEvent(lm.id);
    const u = await makeUser();
    expect(ev.isPublicVenue).toBe(true);
    const r = await prisma.eventRsvp.create({ data: { eventId: ev.id, userId: u.id, status: "interested" } });
    await prisma.eventRsvp.update({ where: { id: r.id }, data: { status: "going" } });
    await expect(prisma.eventRsvp.create({ data: { eventId: ev.id, userId: u.id, status: "going" } })).rejects.toThrow();
    await prisma.event.update({ where: { id: ev.id }, data: { capacity: 50 } });
    await prisma.event.delete({ where: { id: ev.id } });
    expect(await prisma.eventRsvp.count()).toBe(0); // cascade
  });

  it("QueueEntry (party size + bucket)", async () => {
    const lm = await makeLandmark();
    const u = await makeUser();
    const q = await prisma.queueEntry.create({ data: { userId: u.id, targetPartySize: 4, lat: 37.43, lng: -122.17, bucketLandmarkId: lm.id } });
    expect(q.status).toBe("waiting");
    expect(q.eventId).toBeNull();
    await prisma.queueEntry.update({ where: { id: q.id }, data: { status: "left" } });
    await prisma.queueEntry.delete({ where: { id: q.id } });
  });

  it("Party + PartyMember (no duplicate member)", async () => {
    const lm = await makeLandmark();
    const ev = await makeEvent(lm.id);
    const p = await makeParty(lm.id, ev.id);
    const u = await makeUser();
    const m = await prisma.partyMember.create({ data: { partyId: p.id, userId: u.id } });
    await expect(prisma.partyMember.create({ data: { partyId: p.id, userId: u.id } })).rejects.toThrow();
    await prisma.partyMember.update({ where: { id: m.id }, data: { checkedInAt: new Date() } });
    await prisma.party.update({ where: { id: p.id }, data: { status: "confirmed", rationale: "All climbers" } });
    await prisma.party.delete({ where: { id: p.id } });
    expect(await prisma.partyMember.count()).toBe(0);
  });

  it("Chat + ChatMember + ChatMessage (squad type, expiry, archive)", async () => {
    const lm = await makeLandmark();
    const p = await makeParty(lm.id);
    const u = await makeUser();
    const expiresAt = new Date("2026-11-15T21:00:00Z");
    const c = await prisma.chat.create({ data: { type: "squad", partyId: p.id, expiresAt, title: "Squad" } });
    await prisma.chatMember.create({ data: { chatId: c.id, userId: u.id } });
    await expect(prisma.chatMember.create({ data: { chatId: c.id, userId: u.id } })).rejects.toThrow();
    const msg = await prisma.chatMessage.create({ data: { chatId: c.id, kind: "host", body: "Welcome!" } });
    await prisma.chatMessage.create({ data: { chatId: c.id, senderId: u.id, body: "hi" } });
    await prisma.chatMessage.update({ where: { id: msg.id }, data: { body: "Welcome, squad!" } });
    const full = await prisma.chat.update({ where: { id: c.id }, data: { archived: true }, include: { messages: true, members: true } });
    expect(full.archived).toBe(true);
    expect(full.expiresAt?.toISOString()).toBe(expiresAt.toISOString());
    expect(full.messages).toHaveLength(2);
    await expect(prisma.chat.create({ data: { type: "squad", partyId: p.id } })).rejects.toThrow(); // one chat per party
    await prisma.chatMessage.delete({ where: { id: msg.id } });
    await prisma.chat.delete({ where: { id: c.id } });
    expect(await prisma.chatMember.count()).toBe(0);
  });

  it("TalkCard", async () => {
    const lm = await makeLandmark();
    const p = await makeParty(lm.id);
    const [a, b] = await Promise.all([makeUser(), makeUser()]);
    const t = await prisma.talkCard.create({
      data: { partyId: p.id, ownerId: a.id, subjectId: b.id, content: { claims: [{ text: "Both climb", source: "likes[3]" }], openers: ["Where do you boulder?"] } },
    });
    await expect(prisma.talkCard.create({ data: { partyId: p.id, ownerId: a.id, subjectId: b.id, content: {} } })).rejects.toThrow();
    await prisma.talkCard.update({ where: { id: t.id }, data: { content: { claims: [], openers: [] } } });
    await prisma.talkCard.delete({ where: { id: t.id } });
  });

  it("PreChat (simulated by default)", async () => {
    const lm = await makeLandmark();
    const p = await makeParty(lm.id);
    const pc = await prisma.preChat.create({ data: { partyId: p.id, userAId: "a", userBId: "b", transcript: [{ speaker: "A", text: "hi" }], sparks: ["climbing"] } });
    expect(pc.simulated).toBe(true);
    await prisma.preChat.update({ where: { id: pc.id }, data: { sparks: [] } });
    await prisma.preChat.delete({ where: { id: pc.id } });
  });

  it("AgentTrace", async () => {
    const lm = await makeLandmark();
    const p = await makeParty(lm.id);
    const t = await prisma.agentTrace.create({
      data: { partyId: p.id, agent: "party_formation", stepIndex: 0, kind: "tool_call", toolName: "scoreGroup", input: { ids: ["a"] }, output: { score: 0.8 }, summary: "Scored group A" },
    });
    await prisma.agentTrace.update({ where: { id: t.id }, data: { summary: "Scored candidate group A" } });
    expect(await prisma.agentTrace.count({ where: { partyId: p.id } })).toBe(1);
    await prisma.agentTrace.delete({ where: { id: t.id } });
  });

  it("DeviceSession", async () => {
    const u = await makeUser({ isLive: true, isSimulated: false });
    const s = await prisma.deviceSession.create({ data: { userId: u.id } });
    await prisma.deviceSession.update({ where: { id: s.id }, data: { lastSeenAt: new Date() } });
    expect((await prisma.deviceSession.findUnique({ where: { id: s.id }, include: { user: true } }))?.user.isLive).toBe(true);
    await prisma.deviceSession.delete({ where: { id: s.id } });
  });

  it("deleting a user cascades to their owned rows", async () => {
    const u = await makeUser();
    const v = await makeUser();
    await prisma.availability.create({ data: { userId: u.id, dayOfWeek: 1, startMin: 0, endMin: 60 } });
    await prisma.block.create({ data: { blockerId: u.id, blockedId: v.id } });
    await prisma.user.delete({ where: { id: u.id } });
    expect(await prisma.availability.count()).toBe(0);
    expect(await prisma.block.count()).toBe(0);
  });
});

describe("domain enums", () => {
  it("validates enum-like strings", () => {
    expect(AgeBand.safeParse("18-24").success).toBe(true);
    expect(AgeBand.safeParse("21").success).toBe(false);
    expect(ChatType.safeParse("squad").success).toBe(true);
    expect(FriendshipSource.safeParse("queue_up").success).toBe(true);
    expect(PartySize.safeParse(1).success).toBe(false);
    expect(PartySize.safeParse(9).success).toBe(false);
    expect(PartySize.safeParse(5).success).toBe(true);
  });

  it("maps ages to bands", () => {
    expect([13, 15, 16, 17, 18, 24, 25, 30].map(ageBandFor)).toEqual(["13-15", "13-15", "16-17", "16-17", "18-24", "18-24", "25+", "25+"]);
    expect(() => ageBandFor(12)).toThrow();
  });

  it("normalizes friendship pairs", () => {
    expect(normalizePair("b", "a")).toEqual(["a", "b"]);
    expect(() => normalizePair("a", "a")).toThrow();
  });
});
