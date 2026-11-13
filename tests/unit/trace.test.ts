import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { seedDatabase } from "@/lib/seed/seed";
import { joinQueue } from "@/lib/server/queue";
import { tickAndAccept } from "../helpers/squad";
import { setSetting } from "@/lib/server/settings";
import { getTrace } from "@/lib/server/trace";
import { createSampleLiveUser } from "@/lib/server/signup";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("agent trace", () => {
  beforeEach(async () => {
    await seedDatabase(prisma, { now: new Date(2026, 10, 12, 9) });
    await setSetting("simFillMs", "0");
  });

  it("is written for every party, covering both agents in order", async () => {
    await joinQueue("p01", { eventId: null, targetSize: 6, landmarkId: "lm-downtown-pa", locationSource: "manual" });
    const live = await createSampleLiveUser(prisma, { name: "Robin Live", ageBand: "18-24", gender: null, womenOnlyParty: false });
    await joinQueue(live.userId, { eventId: "ev-board-game-night", targetSize: 4, landmarkId: "lm-cal-ave", locationSource: "manual" });
    await wait(400);
    await tickAndAccept();
    const parties = await prisma.party.findMany({ where: { status: "confirmed" } });
    expect(parties.length).toBeGreaterThanOrEqual(2);
    for (const p of parties) {
      const t = await getTrace(p.id);
      expect(t.map((s) => s.stepIndex)).toEqual(t.map((_, i) => i));
      const agents = [...new Set(t.map((s) => s.agent))];
      expect(agents.slice(0, 2)).toEqual(["party_formation", "event_selection"]);
      expect(agents).toContain("host");
      expect(t.some((s) => s.kind === "safety_check" && s.agent === "party_formation")).toBe(true);
      expect(t.filter((s) => s.kind === "decision" && ["party_formation", "event_selection"].includes(s.agent))).toHaveLength(2);
      expect(t.every((s) => s.summary.length > 0)).toBe(true);
    }
  });
});
