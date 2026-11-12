import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { seedDatabase } from "@/lib/seed/seed";
import { getBadges, markTabSeen, unreadByChat } from "@/lib/server/badges";
import { publish, subscribe } from "@/lib/server/bus";

describe("badges", () => {
  beforeAll(async () => {
    await seedDatabase(prisma, { now: new Date() });
  });

  it("counts unread chats and pending requests, clears on tab seen", async () => {
    const b = await getBadges("p01");
    expect(b.chats).toBeGreaterThan(0);
    expect(b.friends).toBe(1);
    await markTabSeen("p01", "chats");
    await markTabSeen("p01", "friends");
    const after = await getBadges("p01");
    expect(after.chats).toBe(0);
    expect(after.friends).toBe(0);
    // per-chat unread counts are independent of the tab badge
    const per = await unreadByChat("p01");
    expect([...per.values()].some((n) => n > 0)).toBe(true);
  });

  it("new messages after the tab was seen re-raise the badge", async () => {
    await markTabSeen("p01", "chats", new Date(Date.now() - 1000));
    await prisma.chatMessage.create({ data: { chatId: "chat-dm-p02", senderId: "p02", body: "yo" } });
    expect((await getBadges("p01")).chats).toBe(1);
  });
});

describe("bus", () => {
  it("delivers published messages to subscribers", () => {
    const got: string[] = [];
    const off = subscribe((m) => got.push(m.topic));
    publish("badges", {}, ["p01"]);
    off();
    publish("badges");
    expect(got).toEqual(["badges"]);
  });
});
