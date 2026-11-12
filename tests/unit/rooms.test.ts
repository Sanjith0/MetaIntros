import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { mockProvider } from "@/lib/ai";
import { seedDatabase } from "@/lib/seed/seed";
import { agentEventChooser, setEventChooser } from "@/lib/server/pipeline";
import { getQueueStatus, joinQueue, leaveQueue, tick } from "@/lib/server/queue";
import { resetRooms } from "@/lib/server/rooms";
import { setSetting } from "@/lib/server/settings";
import { getTalkCards } from "@/lib/server/talkCards";
import { getTrace } from "@/lib/server/trace";
import { getPreChatsFor } from "@/lib/server/preChats";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const join = (size: number, eventId: string | null = "ev-indie-guild") => joinQueue("p01", { eventId, targetSize: size, landmarkId: "lm-downtown-pa", locationSource: "manual" });
const confirmed = () => prisma.party.findFirstOrThrow({ where: { status: "confirmed" }, include: { members: true } });

describe("Companion engine in the queue", () => {
  beforeEach(async () => {
    mockProvider().reset();
    resetRooms();
    setEventChooser(agentEventChooser);
    await seedDatabase(prisma, { now: new Date() });
    await setSetting("simFillMs", "0");
  });

  it("a queued user is matched through a room of 12 and the squad is exactly the chosen size", async () => {
    await join(5);
    await wait(300);
    expect(await prisma.queueEntry.count({ where: { status: "waiting" } })).toBe(12); // Me + 11 simulated fillers
    expect(await tick()).toBe(1);
    const party = await confirmed();
    expect(party.members).toHaveLength(5);
    expect(party.members.map((m) => m.userId)).toContain("p01");
    expect(party.members.map((m) => m.userId)).not.toContain("p09"); // Me blocked p09
    expect(party.rationale).toBeTruthy();
    expect(await prisma.party.count()).toBe(1); // squads of only simulated fillers are never formed
    expect(await prisma.queueEntry.count({ where: { status: "waiting" } })).toBe(0); // spare fillers withdrawn
    const room = await prisma.matchRoom.findFirstOrThrow();
    expect(room.stage).toBe("done");
    expect(room.result).toMatchObject({ squads: 1 });
  });

  it("Companion conversations between squad members become PreChat rows that feed talk cards", async () => {
    await join(5);
    await wait(300);
    await tick();
    const party = await confirmed();
    const rows = await prisma.preChat.findMany({ where: { partyId: party.id } });
    expect(rows).toHaveLength((5 * 4) / 2);
    expect(rows.every((r) => r.simulated && (r.transcript as unknown[]).length >= 6 && (r.sparks as string[]).length >= 1)).toBe(true);
    const mine = await getPreChatsFor(party.id, "p01");
    expect(mine).toHaveLength(4);
    for (const pc of mine) expect(pc.transcript.every((t) => t.speaker === "A" || t.speaker === "B")).toBe(true);
    const cards = await getTalkCards(party.id, "p01");
    const sparks = cards.flatMap((c) => c.content.claims.filter((x) => x.kind === "spark"));
    expect(sparks).toHaveLength(4);
    for (const s of sparks) expect(s.sources[0]).toMatch(/^preChat:/);
  });

  it("the trace starts with the Orchestrator and covers the Companions, the code re-check and the event pick", async () => {
    await join(4);
    await wait(300);
    await tick();
    const t = await getTrace((await confirmed()).id);
    expect(t[0].agent).toBe("orchestrator");
    expect(t.some((s) => s.agent === "companion" && s.toolName === "companionRounds")).toBe(true);
    expect(t.some((s) => s.kind === "safety_check")).toBe(true);
    expect(t.some((s) => s.agent === "event_selection" && s.kind === "decision")).toBe(true);
    expect(t.map((s) => s.stepIndex)).toEqual(t.map((_, i) => i));
  });

  it("each Companion prompt holds exactly one brief, and sensitive model text never reaches a squad", async () => {
    mockProvider().on("companion_answer", (req) => {
      const u = JSON.parse(req.messages[1].content);
      return JSON.stringify({ answers: Object.fromEntries(u.circle_mates.map((m: { id: string }) => [m.id, { say: "Do they go to church?", cites: [] }])), verdicts: {}, picks: [] });
    });
    await join(4);
    await wait(300);
    await tick();
    const calls = mockProvider().calls.filter((x) => x.task.startsWith("companion_") && x.task !== "companion_brief");
    expect(calls.length).toBeGreaterThan(20);
    for (const c of calls) {
      expect(Object.keys(JSON.parse(c.messages[1].content))).toContain("your_brief");
      expect(c.messages[1].content.match(/"ownerId"/g)).toHaveLength(1);
    }
    expect((await prisma.preChat.findMany()).length).toBeGreaterThan(0);
    expect(JSON.stringify(await prisma.preChat.findMany())).not.toMatch(/church/i);
  });

  it("leaving the queue mid-run drops that squad and leaves nobody stuck as matched", async () => {
    let left = false;
    mockProvider().on("companion_group2", async () => {
      if (!left) {
        left = true;
        await leaveQueue("p01");
      }
      return JSON.stringify({ line: { say: "Sounds good.", cites: [] }, decision: "yes" });
    });
    await join(4);
    await wait(300);
    expect(await tick()).toBe(0);
    expect(left).toBe(true);
    expect(await prisma.party.count({ where: { status: "confirmed" } })).toBe(0);
    expect(await prisma.queueEntry.count({ where: { status: "matched" } })).toBe(0);
    expect(await prisma.preChat.count()).toBe(0);
  });

  it("a room whose pick has no usable event is not re-run forever", async () => {
    setEventChooser(async () => null);
    await prisma.event.deleteMany({ where: { kind: "event" } });
    await join(4, null);
    await wait(300);
    expect(await tick()).toBe(0);
    expect(await prisma.queueEntry.count({ where: { status: "matched" } })).toBe(0);
    expect(await prisma.queueEntry.count({ where: { userId: "p01", status: "waiting" } })).toBe(1);
    // each failed pick is excluded; the room settles once nothing new can be proposed
    let runs = 0;
    for (let i = 0; i < 12; i++) {
      const before = await prisma.matchRoom.count();
      await tick();
      if ((await prisma.matchRoom.count()) === before) break;
      runs++;
    }
    expect(runs).toBeLessThan(12);
    const settled = mockProvider().calls.length;
    await tick();
    expect(mockProvider().calls.length).toBe(settled);
    expect(await prisma.party.count({ where: { status: "confirmed" } })).toBe(0);
  });

  it("hangout queue: the squad the Companions settle on is one the planner can actually place", async () => {
    await joinQueue("p01", { mode: "hangout", eventId: null, targetSize: 4, landmarkId: "lm-downtown-pa", locationSource: "manual" });
    await wait(300);
    expect(await tick()).toBe(1);
    const party = await prisma.party.findFirstOrThrow({ where: { status: "confirmed" }, include: { members: true, event: true } });
    expect(party.members.map((m) => m.userId)).toContain("p01");
    expect(party.event?.kind).toBe("hangout");
    expect(await prisma.party.count({ where: { status: "cancelled" } })).toBe(0); // nothing was formed and then dropped
  });

  it("a room of only simulated people spends no model calls", async () => {
    const lm = await prisma.landmark.findUniqueOrThrow({ where: { id: "lm-downtown-pa" } });
    const sims = (await prisma.user.findMany({ where: { isSimulated: true, ageBand: "18-24", womenOnlyParty: false }, orderBy: { id: "asc" }, take: 8 })).map((u) => u.id);
    for (const userId of sims) await prisma.queueEntry.create({ data: { userId, eventId: "ev-indie-guild", targetPartySize: 4, lat: lm.lat, lng: lm.lng, bucketLandmarkId: lm.id } });
    await tick();
    expect(mockProvider().calls.filter((c) => c.task.startsWith("companion_") || c.task.startsWith("orchestrator_"))).toHaveLength(0);
  });

  it("getQueueStatus reports what the Companions are doing while a room runs", async () => {
    const seen: { stage?: string; state: string }[] = [];
    mockProvider().on("companion_ask", async () => {
      if (!seen.length) seen.push(await getQueueStatus("p01"));
      return JSON.stringify({ asks: {} });
    });
    await join(4);
    await wait(300);
    await tick();
    expect(seen[0]).toMatchObject({ state: "waiting", stage: "mingling" });
    expect((await getQueueStatus("p01")).state).toBe("matched");
  });
});
