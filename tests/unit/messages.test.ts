import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { seedDatabase } from "@/lib/seed/seed";
import { postMessage } from "@/lib/server/messages";
import { subscribe } from "@/lib/server/bus";

describe("chat messages", () => {
  beforeAll(async () => {
    await seedDatabase(prisma, { now: new Date() });
  });

  it("posts, bumps recency, and publishes to members only", async () => {
    const got: { topic: string; userIds?: string[] }[] = [];
    const off = subscribe((m) => got.push(m));
    const r = await postMessage("chat-dm-p02", "p01", "  hello there  ");
    off();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.message.body).toBe("hello there");
    const chat = await prisma.chat.findUniqueOrThrow({ where: { id: "chat-dm-p02" } });
    expect(chat.lastMessageAt.getTime()).toBeGreaterThan(Date.now() - 5000);
    const evt = got.find((g) => g.topic === "chat")!;
    expect(evt.userIds!.sort()).toEqual(["p01", "p02"]);
  });

  it("rejects non-members, empty bodies and archived chats", async () => {
    expect(await postMessage("chat-dm-p02", "p50", "hi")).toEqual({ ok: false, error: "not_member" });
    expect(await postMessage("chat-dm-p02", "p01", "   ")).toEqual({ ok: false, error: "empty" });
    await prisma.chat.update({ where: { id: "chat-dm-p02" }, data: { archived: true } });
    expect(await postMessage("chat-dm-p02", "p01", "still here?")).toEqual({ ok: false, error: "archived" });
  });
});
