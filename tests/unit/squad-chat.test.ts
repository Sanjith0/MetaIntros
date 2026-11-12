import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { seedDatabase } from "@/lib/seed/seed";
import { joinQueue } from "@/lib/server/queue";
import { tickAndAccept } from "../helpers/squad";
import { setSetting } from "@/lib/server/settings";
import { listInbox } from "@/lib/server/chats";
import { getBadges, markTabSeen } from "@/lib/server/badges";
import { getSquadHeader, CHAT_TTL_AFTER_EVENT_MS } from "@/lib/server/squadChat";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("squad chat", () => {
  beforeEach(async () => {
    await seedDatabase(prisma, { now: new Date() });
    await setSetting("simFillMs", "0");
    await markTabSeen("p01", "chats");
  });

  it("appears pinned at the top of every member's inbox when a party forms, with badge + details", async () => {
    expect((await getBadges("p01")).chats).toBe(0);
    await joinQueue("p01", { eventId: "ev-indie-guild", targetSize: 6, landmarkId: "lm-downtown-pa", locationSource: "manual" });
    await wait(300);
    expect(await tickAndAccept()).toBe(1);
    const party = await prisma.party.findFirstOrThrow({ where: { status: "confirmed" }, include: { members: true, event: true, chat: true } });
    const chat = party.chat!;
    expect(chat.type).toBe("squad");
    expect(chat.eventId).toBe("ev-indie-guild");
    expect(chat.expiresAt!.getTime()).toBe(party.event!.endsAt.getTime() + CHAT_TTL_AFTER_EVENT_MS);

    for (const m of party.members) {
      const inbox = await listInbox(m.userId);
      expect(inbox[0].id).toBe(chat.id);
      expect(inbox[0].unread).toBeGreaterThan(0);
    }
    expect((await getBadges("p01")).chats).toBe(1);

    const h = (await getSquadHeader(chat.id))!;
    expect(h.event.title).toBe("Indie Night: Local Bands Showcase");
    expect(h.meetingSpot).toContain("The Guild Theatre");
    expect(h.members).toHaveLength(6);
  });
});
