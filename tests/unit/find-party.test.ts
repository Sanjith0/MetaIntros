import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { seedDatabase } from "@/lib/seed/seed";
import { joinQueue, tick } from "@/lib/server/queue";
import { setSetting } from "@/lib/server/settings";
import { arrivals, checkIn, getPartyPhoto, setPartyPhoto } from "@/lib/server/companion";
import { subscribe } from "@/lib/server/bus";
import { fastForward } from "@/lib/server/expiry";
import { getPartyForUser } from "@/lib/server/party";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

describe("find your party", () => {
  let partyId = "";
  let mate = "";
  beforeEach(async () => {
    await seedDatabase(prisma, { now: new Date() });
    await setSetting("simFillMs", "0");
    await joinQueue("p01", { eventId: "ev-indie-guild", targetSize: 4, landmarkId: "lm-downtown-pa", locationSource: "manual" });
    await wait(300);
    await tick();
    const p = await prisma.party.findFirstOrThrow({ where: { status: "confirmed" }, include: { members: true } });
    partyId = p.id;
    mate = p.members.find((m) => m.userId !== "p01")!.userId;
  });

  it("party-only photos are visible to members only, and only after opting in", async () => {
    expect(await getPartyPhoto(partyId, mate, "p01")).toBeNull(); // not opted in yet
    expect(await setPartyPhoto(partyId, "p01", "javascript:alert(1)")).toMatchObject({ ok: false, error: "bad_image" });
    expect(await setPartyPhoto(partyId, "p66", PNG)).toMatchObject({ ok: false, error: "not_member" });
    expect((await setPartyPhoto(partyId, "p01", PNG)).ok).toBe(true);
    expect(await getPartyPhoto(partyId, mate, "p01")).toBe(PNG);
    expect(await getPartyPhoto(partyId, "p66", "p01")).toBeNull(); // outsider
    expect(await getPartyForUser("p66", partyId)).toBeNull();
    expect((await getPartyForUser(mate, partyId))!.members.find((m) => m.userId === "p01")!.photoUrl).toBe(PNG);
    await setPartyPhoto(partyId, "p01", null); // opt out deletes
    expect(await getPartyPhoto(partyId, mate, "p01")).toBeNull();
  });

  it("photos are deleted when the squad chat ends", async () => {
    await setPartyPhoto(partyId, "p01", PNG);
    await fastForward("p01");
    expect(await getPartyPhoto(partyId, mate, "p01")).toBeNull();
  });

  it("check-ins update the arrival list for every member", async () => {
    const got: { topic: string; userIds?: string[] }[] = [];
    const off = subscribe((m) => got.push(m));
    expect((await checkIn(partyId, "p01")).ok).toBe(true);
    off();
    const evt = got.find((g) => g.topic === "party-update")!;
    expect(evt.userIds!.sort()).toEqual((await prisma.partyMember.findMany({ where: { partyId } })).map((m) => m.userId).sort());
    const list = await arrivals(partyId);
    expect(list.find((a) => a.id === "p01")!.checkedInAt).not.toBeNull();
    expect(list.filter((a) => a.checkedInAt)).toHaveLength(1);
    expect((await checkIn(partyId, "p66")).ok).toBe(false);
  });
});
