import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { mockProvider } from "@/lib/ai";
import { seedDatabase } from "@/lib/seed/seed";
import { joinQueue, tick } from "@/lib/server/queue";
import { setSetting } from "@/lib/server/settings";
import { afterUserMessage, checkStalls, hostContext, postHostWelcome } from "@/lib/server/host";
import { postMessage } from "@/lib/server/messages";
import { icebreakerIsGrounded, templateWelcome } from "@/lib/agents/host";
import { label } from "@/lib/agents/describe";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function formSquad() {
  await joinQueue("p01", { eventId: "ev-indie-guild", targetSize: 6, landmarkId: "lm-downtown-pa", locationSource: "manual" });
  await wait(300);
  await tick();
  const party = await prisma.party.findFirstOrThrow({ where: { status: "confirmed" }, include: { chat: true } });
  return { party, chatId: party.chat!.id };
}

describe("AI host", () => {
  beforeEach(async () => {
    mockProvider().reset();
    await seedDatabase(prisma, { now: new Date() });
    await setSetting("simFillMs", "0");
  });

  it("posts exactly one welcome (+ one icebreaker), even if triggered again", async () => {
    const { party, chatId } = await formSquad();
    await postHostWelcome(party.id);
    await postHostWelcome(party.id);
    const host = await prisma.chatMessage.findMany({ where: { chatId, kind: "host" }, orderBy: { createdAt: "asc" } });
    expect(host).toHaveLength(2);
    expect(host[0].body).toMatch(/Indie Night/);
    expect(host[0].body).toMatch(/The Guild Theatre/);
    expect(host.filter((m) => m.body.startsWith("Icebreaker")).length).toBe(1);
  });

  it("the icebreaker references a real interest that ≥2 squad members share", async () => {
    const { chatId } = await formSquad();
    const ctx = (await hostContext(chatId))!;
    const ice = (await prisma.chatMessage.findFirstOrThrow({ where: { chatId, body: { startsWith: "Icebreaker:" } } })).body.toLowerCase();
    const sharedLabels = ctx.shared.filter((s) => s.count >= 2).map((s) => label(s.tag).toLowerCase());
    expect(sharedLabels.some((l) => ice.includes(l))).toBe(true);
  });

  it("rejects an ungrounded model icebreaker and uses the template", async () => {
    const ctx = { eventTitle: "X", when: "Sat", meetingSpot: "door", memberNames: ["A", "B"], shared: [{ tag: "climbing", count: 3 }] };
    expect(icebreakerIsGrounded({ welcome: "hi there all", icebreaker: "Favorite skydiving spot?", interestTag: "skydiving" }, ctx)).toBe(false);
    expect(icebreakerIsGrounded({ welcome: "hi there all", icebreaker: "Who else loves climbing outdoors?", interestTag: "climbing" }, ctx)).toBe(true);
    expect(icebreakerIsGrounded(templateWelcome(ctx), ctx)).toBe(true);
  });

  it("stays quiet unless @mentioned", async () => {
    const { chatId } = await formSquad();
    const before = await prisma.chatMessage.count({ where: { chatId, kind: "host" } });
    await postMessage(chatId, "p01", "hey everyone!");
    await afterUserMessage(chatId, "p01", "hey everyone!");
    expect(await prisma.chatMessage.count({ where: { chatId, kind: "host" } })).toBe(before);
    mockProvider().on("host_reply", () => JSON.stringify({ reply: "Meet at the front entrance at 7:20!" }));
    await afterUserMessage(chatId, "p01", "@host where do we meet?");
    const last = await prisma.chatMessage.findFirstOrThrow({ where: { chatId, kind: "host" }, orderBy: { createdAt: "desc" } });
    expect(last.body).toBe("Meet at the front entrance at 7:20!");
  });

  it("nudges a stalled chat (at most twice)", async () => {
    const { chatId } = await formSquad();
    await postMessage(chatId, "p01", "hi");
    await setSetting("stallMs", "0");
    const later = Date.now() + 1000;
    await checkStalls(later);
    await checkStalls(later); // last message is now the host's → no double nudge
    expect(await prisma.chatMessage.count({ where: { chatId, body: { startsWith: "Quiet in here" } } })).toBe(1);
  });
});
