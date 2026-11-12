import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { seedDatabase } from "@/lib/seed/seed";
import { joinQueue } from "@/lib/server/queue";
import { tickAndAccept } from "../helpers/squad";
import { setSetting } from "@/lib/server/settings";
import { fastForward } from "@/lib/server/expiry";
import { sendSquadRequest } from "@/lib/server/friending";
import { listQueueUpFriends } from "@/lib/server/friends";
import { getBadges, markTabSeen } from "@/lib/server/badges";
import type { CardContent } from "@/lib/cards/claims";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("Met through Queue Up", () => {
  beforeEach(async () => {
    await seedDatabase(prisma, { now: new Date() });
    await setSetting("simFillMs", "0");
    await setSetting("simAcceptMs", "0");
    await markTabSeen("p01", "friends");
  });

  it("new friends appear with the event where they met + top shared interest from the talk card; badge works", async () => {
    await joinQueue("p01", { eventId: "ev-boulder-social", targetSize: 4, landmarkId: "lm-rwc-courthouse", locationSource: "manual" });
    await wait(300);
    await tickAndAccept();
    const party = await prisma.party.findFirstOrThrow({ where: { status: "confirmed" }, include: { members: true } });
    await fastForward("p01");
    expect((await getBadges("p01")).friends).toBe(0);
    const mates = party.members.filter((m) => m.userId !== "p01").map((m) => m.userId);
    for (const m of mates) await sendSquadRequest("p01", m, party.id);

    const rows = await listQueueUpFriends("p01");
    expect(rows.map((r) => r.friend.id).sort()).toEqual(mates.sort());
    for (const r of rows) {
      expect(r.event?.title).toBe("Bouldering Social + Beginner Clinic");
      const card = await prisma.talkCard.findUniqueOrThrow({ where: { partyId_ownerId_subjectId: { partyId: party.id, ownerId: "p01", subjectId: r.friend.id } } });
      const first = (card.content as unknown as CardContent).claims.find((c) => c.kind === "shared_interest")!;
      expect(first.text).toContain(r.sharedNote!);
    }
    expect((await getBadges("p01")).friends).toBe(3);
    await markTabSeen("p01", "friends");
    expect((await getBadges("p01")).friends).toBe(0);
  });
});
