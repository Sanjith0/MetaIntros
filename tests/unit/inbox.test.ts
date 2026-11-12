import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { seedDatabase } from "@/lib/seed/seed";
import { listInbox, sortInbox } from "@/lib/server/chats";

describe("inbox", () => {
  beforeAll(async () => {
    await seedDatabase(prisma, { now: new Date() });
  });

  it("lists Me's seeded direct + group chats sorted by recent activity", async () => {
    const rows = await listInbox("p01");
    expect(rows.length).toBe(12);
    for (let i = 1; i < rows.length; i++) expect(rows[i - 1].lastMessageAt.getTime()).toBeGreaterThanOrEqual(rows[i].lastMessageAt.getTime());
    expect(rows.find((r) => r.id === "chat-group-1")?.title).toBe("Roommates 🏠");
    expect(rows.find((r) => r.id === "chat-dm-p02")?.title).toBe((await prisma.user.findUnique({ where: { id: "p02" } }))!.name);
  });

  it("reports unread counts", async () => {
    const rows = await listInbox("p01");
    expect(rows.filter((r) => r.unread > 0).length).toBeGreaterThan(0);
    expect(rows.filter((r) => r.unread === 0).length).toBeGreaterThan(0);
  });

  it("pins active squad chats above everything", () => {
    const t = (h: number) => new Date(2026, 0, 1, h);
    const sorted = sortInbox([
      { id: "a", type: "direct", archived: false, lastMessageAt: t(10) },
      { id: "s", type: "squad", archived: false, lastMessageAt: t(1) },
      { id: "x", type: "squad", archived: true, lastMessageAt: t(2) },
      { id: "b", type: "group", archived: false, lastMessageAt: t(9) },
    ]);
    expect(sorted.map((r) => r.id)).toEqual(["s", "a", "b", "x"]);
  });
});
