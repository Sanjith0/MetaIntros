import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { seedDatabase } from "@/lib/seed/seed";
import { joinQueue, tick } from "@/lib/server/queue";
import { setSetting } from "@/lib/server/settings";
import { createSampleLiveUser } from "@/lib/server/signup";
import { fastForward } from "@/lib/server/expiry";
import { respondToRequest, sendSquadRequest, squadConnectState } from "@/lib/server/friending";
import { listQueueUpFriends, listRequests } from "@/lib/server/friends";
import { normalizePair } from "@/lib/domain/enums";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const friendship = (a: string, b: string) => {
  const [x, y] = normalizePair(a, b);
  return prisma.friendship.findUnique({ where: { userAId_userBId: { userAId: x, userBId: y } } });
};

describe("mutual opt-in friending", () => {
  let partyId = "";
  let live = "";
  beforeEach(async () => {
    await seedDatabase(prisma, { now: new Date() });
    await setSetting("fillMode", "live");
    live = (await createSampleLiveUser(prisma, { name: "Kim Live", ageBand: "18-24", gender: null, womenOnlyParty: false })).userId;
    await joinQueue("p01", { eventId: "ev-indie-guild", targetSize: 2, landmarkId: "lm-downtown-pa", locationSource: "manual" });
    await joinQueue(live, { eventId: "ev-indie-guild", targetSize: 2, landmarkId: "lm-downtown-pa", locationSource: "manual" });
    await tick();
    partyId = (await prisma.party.findFirstOrThrow({ where: { status: "confirmed" } })).id;
  });

  it("is only possible after the event", async () => {
    expect(await sendSquadRequest("p01", live, partyId)).toMatchObject({ ok: false, error: "event_not_over" });
  });

  it("one-sided requests stay pending in Requests; friendship only on mutual acceptance", async () => {
    await fastForward("p01");
    expect(await sendSquadRequest("p01", live, partyId)).toMatchObject({ ok: true, state: "requested" });
    expect(await friendship("p01", live)).toBeNull();
    expect((await listRequests(live)).incoming.map((r) => r.fromId)).toEqual(["p01"]);
    expect((await listRequests("p01")).outgoing.map((r) => r.toId)).toEqual([live]);
    expect((await squadConnectState(live, partyId))!.members[0].state).toBe("incoming");

    // the other side opts in too → friends
    expect(await sendSquadRequest(live, "p01", partyId)).toMatchObject({ ok: true, state: "friends" });
    const f = (await friendship("p01", live))!;
    expect(f.source).toBe("queue_up");
    expect(f.metAtEventId).toBe("ev-indie-guild");
    expect(f.sharedNote).toBeTruthy();
    expect((await listRequests(live)).incoming).toHaveLength(0);
    expect((await listQueueUpFriends("p01")).map((q) => q.friend.id)).toEqual([live]);
  });

  it("declining leaves no friendship", async () => {
    await fastForward("p01");
    const r = await sendSquadRequest("p01", live, partyId);
    await respondToRequest(live, (r as { requestId: string }).requestId, false);
    expect(await friendship("p01", live)).toBeNull();
  });

  it("non-members can't send squad requests", async () => {
    await fastForward("p01");
    expect(await sendSquadRequest("p66", live, partyId)).toMatchObject({ ok: false, error: "not_in_party" });
  });
});

describe("simulated squadmates (demo)", () => {
  it("accept after a short delay", async () => {
    await seedDatabase(prisma, { now: new Date() });
    await setSetting("simFillMs", "0");
    await setSetting("simAcceptMs", "0");
    await joinQueue("p01", { eventId: "ev-indie-guild", targetSize: 3, landmarkId: "lm-downtown-pa", locationSource: "manual" });
    await wait(300);
    await tick();
    const party = await prisma.party.findFirstOrThrow({ where: { status: "confirmed" }, include: { members: true } });
    await fastForward("p01");
    const sim = party.members.find((m) => m.userId !== "p01")!.userId;
    await sendSquadRequest("p01", sim, party.id);
    expect((await friendship("p01", sim))?.source).toBe("queue_up");
  });
});
