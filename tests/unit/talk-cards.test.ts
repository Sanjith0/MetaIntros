import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { mockProvider } from "@/lib/ai";
import { seedDatabase } from "@/lib/seed/seed";
import { joinQueue, tick } from "@/lib/server/queue";
import { setSetting } from "@/lib/server/settings";
import { getTalkCards } from "@/lib/server/talkCards";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("talk cards", () => {
  beforeEach(async () => {
    mockProvider().reset();
    await seedDatabase(prisma, { now: new Date() });
    await setSetting("simFillMs", "0");
  });

  it("every member gets one card per other member with shared interests, mutuals, a pattern and openers", async () => {
    mockProvider().on("talk_cards", (req) => {
      const { pairs } = JSON.parse(req.messages[1].content);
      return JSON.stringify({ pairs: pairs.map((p: { owner: string; subject: string; subjectName: string }) => ({ owner: p.owner, subject: p.subject, openers: [`Hey ${p.subjectName}, seen any good shows lately?`, "Where do you usually climb?"] })) });
    });
    await joinQueue("p01", { eventId: "ev-indie-guild", targetSize: 6, landmarkId: "lm-downtown-pa", locationSource: "manual" });
    await wait(300);
    await tick();
    const party = await prisma.party.findFirstOrThrow({ where: { status: "confirmed" }, include: { members: true } });
    expect(await prisma.talkCard.count({ where: { partyId: party.id } })).toBe(6 * 5);
    expect(mockProvider().calls.filter((c) => c.task === "talk_cards")).toHaveLength(1); // one call per party

    const mine = await getTalkCards(party.id, "p01");
    expect(mine).toHaveLength(5);
    expect(mine.map((c) => c.subject.id)).not.toContain("p01");
    for (const c of mine) {
      expect(c.content.generatedBy).toBe("model");
      expect(c.content.claims.filter((x) => x.kind === "shared_interest").length).toBeGreaterThanOrEqual(1);
      expect(c.content.openers.length).toBeGreaterThanOrEqual(2);
      expect(c.content.openers.length).toBeLessThanOrEqual(3);
    }
    const kinds = new Set(mine.flatMap((c) => c.content.claims.map((x) => x.kind)));
    for (const k of ["shared_interest", "mutual_friends", "pattern"]) expect(kinds.has(k as never), k).toBe(true);
  });

  it("falls back to template openers when the model is unavailable", async () => {
    await joinQueue("p01", { eventId: null, targetSize: 4, landmarkId: "lm-downtown-pa", locationSource: "manual" });
    await wait(300);
    await tick();
    const party = await prisma.party.findFirstOrThrow({ where: { status: "confirmed" } });
    const mine = await getTalkCards(party.id, "p01");
    expect(mine).toHaveLength(3);
    for (const c of mine) {
      expect(c.content.generatedBy).toBe("template");
      expect(c.content.openers.length).toBeGreaterThanOrEqual(2);
    }
  });
});
