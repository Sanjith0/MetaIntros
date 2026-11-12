import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { mockProvider } from "@/lib/ai";
import { seedDatabase } from "@/lib/seed/seed";
import { joinQueue, tick } from "@/lib/server/queue";
import { setSetting } from "@/lib/server/settings";
import { getTalkCards } from "@/lib/server/talkCards";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("companion pre-chats", () => {
  beforeEach(async () => {
    mockProvider().reset();
    await seedDatabase(prisma, { now: new Date() });
    await setSetting("simFillMs", "0");
  });

  it("each pre-chat uses only the two profiles involved, is labeled simulated, and feeds talk cards", async () => {
    mockProvider().on("companion_prechat", (req) => {
      const u = JSON.parse(req.messages[1].content);
      return JSON.stringify({
        transcript: [{ speaker: "A", text: `${u.A.name} has been bouldering a ton` }, { speaker: "B", text: `${u.B.name} too, mostly at night` }],
        sparks: [`${u.A.name} and ${u.B.name} both boulder after work`],
      });
    });
    await joinQueue("p01", { eventId: "ev-indie-guild", targetSize: 5, landmarkId: "lm-downtown-pa", locationSource: "manual" });
    await wait(300);
    await tick();
    const party = await prisma.party.findFirstOrThrow({ where: { status: "confirmed" }, include: { members: { include: { user: true } } } });
    const rows = await prisma.preChat.findMany({ where: { partyId: party.id } });
    expect(rows).toHaveLength((5 * 4) / 2);
    expect(rows.every((r) => r.simulated)).toBe(true);

    // model calls only for pairs with a real person (Me), and each prompt has exactly two profiles
    const calls = mockProvider().calls.filter((c) => c.task === "companion_prechat");
    expect(calls).toHaveLength(4);
    const firstNames = party.members.map((m) => m.user.name.split(" ")[0]);
    for (const c of calls) {
      const u = JSON.parse(c.messages[1].content);
      expect(Object.keys(u).sort()).toEqual(["A", "B", "shared"]);
      const present = firstNames.filter((n) => c.messages[1].content.includes(`"name":"${n}"`));
      expect(present).toHaveLength(2);
      expect([u.A.id, u.B.id]).toContain("p01");
    }

    // sparks feed the talk cards, labeled as simulated
    const cards = await getTalkCards(party.id, "p01");
    const sparks = cards.flatMap((c) => c.content.claims.filter((x) => x.kind === "spark"));
    expect(sparks.length).toBe(4);
    for (const s of sparks) {
      expect(s.text).toMatch(/AI pre-chat simulation/);
      expect(s.sources[0]).toMatch(/^preChat:/);
    }
  });

  it("sensitive model output is replaced by the template", async () => {
    mockProvider().on("companion_prechat", () => JSON.stringify({ transcript: [{ speaker: "A", text: "Do you go to church?" }, { speaker: "B", text: "Yes" }], sparks: ["same church"] }));
    await joinQueue("p01", { eventId: "ev-indie-guild", targetSize: 3, landmarkId: "lm-downtown-pa", locationSource: "manual" });
    await wait(300);
    await tick();
    const rows = await prisma.preChat.findMany();
    expect(JSON.stringify(rows.map((r) => r.transcript))).not.toMatch(/church/i);
  });
});
