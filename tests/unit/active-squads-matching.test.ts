import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { seedDatabase } from "@/lib/seed/seed";
import { joinQueue } from "@/lib/server/queue";
import { setSetting } from "@/lib/server/settings";
import { activeSquadPairs } from "@/lib/server/squads";
import { tickAndAccept } from "../helpers/squad";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("a second squad while the first is still on", () => {
  let partyId: string;
  let mates: string[];

  beforeEach(async () => {
    await seedDatabase(prisma, { now: new Date() });
    await setSetting("simFillMs", "0");
    await joinQueue("p01", { eventId: "ev-indie-guild", targetSize: 4, landmarkId: "lm-downtown-pa", locationSource: "manual" });
    await wait(300);
    await tickAndAccept();
    const party = await prisma.party.findFirstOrThrow({ where: { status: "confirmed", members: { some: { userId: "p01" } } }, include: { members: true } });
    partyId = party.id;
    mates = party.members.map((m) => m.userId).filter((id) => id !== "p01");
  });

  it("knows who is already squadmates", async () => {
    const pairs = await activeSquadPairs(["p01"]);
    for (const m of mates) expect(pairs.has("p01" < m ? `p01|${m}` : `${m}|p01`)).toBe(true);
    expect(await activeSquadPairs([])).toEqual(new Set());
  });

  it("never puts the same people (simulated fillers included) in your next squad", async () => {
    const { now } = await import("@/lib/server/clock");
    const t = await now();
    // a different event, while the first squad is still confirmed and its chat open
    const next = await prisma.event.findFirstOrThrow({ where: { kind: "event", isPublicVenue: true, startsAt: { gt: t }, id: { not: "ev-indie-guild" } }, orderBy: { startsAt: "asc" } });
    expect((await joinQueue("p01", { eventId: next.id, targetSize: 4, landmarkId: "lm-downtown-pa", locationSource: "manual" })).ok).toBe(true);
    await wait(300);
    await tickAndAccept();
    const second = await prisma.party.findFirst({ where: { id: { not: partyId }, members: { some: { userId: "p01" } }, status: { not: "cancelled" } }, include: { members: true } });
    expect(second).toBeTruthy();
    expect(second!.members.some((m) => mates.includes(m.userId))).toBe(false);
    expect((await prisma.party.findUniqueOrThrow({ where: { id: partyId } })).status).toBe("confirmed");
  });
});
