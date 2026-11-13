import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { seedDatabase } from "@/lib/seed/seed";
import { joinQueue } from "@/lib/server/queue";
import { tickAndAccept } from "../helpers/squad";
import { setSetting } from "@/lib/server/settings";
import { ARCHIVE_NOTICE, fastForward, sweepExpiredChats } from "@/lib/server/expiry";
import { postMessage } from "@/lib/server/messages";
import { now } from "@/lib/server/clock";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("squad chat expiry", () => {
  beforeEach(async () => {
    await seedDatabase(prisma, { now: new Date() });
    await setSetting("simFillMs", "0");
    await joinQueue("p01", { eventId: "ev-indie-guild", targetSize: 4, landmarkId: "lm-downtown-pa", locationSource: "manual" });
    await wait(300);
    await tickAndAccept();
  });

  it("does not archive before 24h after the event", async () => {
    expect(await sweepExpiredChats()).toEqual([]);
    const chat = await prisma.chat.findFirstOrThrow({ where: { type: "squad" } });
    expect(await sweepExpiredChats(new Date(chat.expiresAt!.getTime() - 1000))).toEqual([]);
  });

  it("fast-forward archives the chat, makes it read-only and shows the add-friends prompt", async () => {
    const r = await fastForward();
    expect(r.ok).toBe(true);
    const chat = await prisma.chat.findFirstOrThrow({ where: { type: "squad" }, include: { party: true } });
    expect(chat.archived).toBe(true);
    expect(chat.party!.status).toBe("completed");
    expect((await now()).getTime()).toBeGreaterThanOrEqual(chat.expiresAt!.getTime()); // ended now, not 24h later
    expect(await postMessage(chat.id, "p01", "hello?")).toEqual({ ok: false, error: "archived" });
    const sys = await prisma.chatMessage.findFirstOrThrow({ where: { chatId: chat.id, kind: "system" }, orderBy: { createdAt: "desc" } });
    expect(sys.body).toBe(ARCHIVE_NOTICE);
    // idempotent
    expect(await sweepExpiredChats()).toEqual([]);
    expect(await prisma.chatMessage.count({ where: { chatId: chat.id, body: ARCHIVE_NOTICE } })).toBe(1);
  });
});
