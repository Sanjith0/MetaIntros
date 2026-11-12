import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { nowMs } from "@/lib/clock";
import { seedDatabase } from "@/lib/seed/seed";
import { advanceClockTo, getClockOffsetMs, now, setClockOffsetMs } from "@/lib/server/clock";
import { fastForward } from "@/lib/server/expiry";
import { postMessage } from "@/lib/server/messages";
import { joinQueue } from "@/lib/server/queue";
import { tickAndAccept } from "../helpers/squad";
import { setSetting } from "@/lib/server/settings";
import { weekendRange } from "@/lib/server/events";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const DAY = 86_400_000;
const close = (a: Date | number, b: Date | number, tol = 5_000) => Math.abs(new Date(a).getTime() - new Date(b).getTime()) < tol;

async function squadFor(eventId: string, size = 4) {
  await joinQueue("p01", { eventId, targetSize: size, landmarkId: "lm-downtown-pa", locationSource: "manual" });
  await wait(300);
  expect(await tickAndAccept()).toBe(1);
  return prisma.party.findFirstOrThrow({ where: { status: "confirmed", eventId }, include: { event: true, chat: true, members: true } });
}

describe("global clock", () => {
  it("every DB timestamp default (incl. nested creates) comes from the global clock", async () => {
    await setClockOffsetMs(3 * DAY);
    await seedDatabase(prisma); // world built around the (moved) global clock
    await setSetting("simFillMs", "0");
    const party = await squadFor("ev-indie-guild");
    const target = nowMs();
    expect(close(party.createdAt, target)).toBe(true);
    for (const m of party.members) expect(close(m.joinedAt, target)).toBe(true); // nested create
    const r = await postMessage(party.chat!.id, "p01", "hi squad");
    expect(r.ok && close(r.message.createdAt, target)).toBe(true);
    const entry = await prisma.queueEntry.findFirstOrThrow({ where: { partyId: party.id, userId: "p01" } });
    expect(close(entry.joinedAt, target, 10_000) && close(entry.matchedAt!, target)).toBe(true);
    const trace = await prisma.agentTrace.findFirstOrThrow({ where: { partyId: party.id } });
    expect(close(trace.createdAt, target)).toBe(true);
  });

  it("the clock only moves forward, and Reset & reseed rebuilds the world around it", async () => {
    await setClockOffsetMs(2 * DAY);
    await advanceClockTo(new Date(Date.now() + DAY)); // earlier than the clock → no-op
    expect(close(await getClockOffsetMs(), 2 * DAY)).toBe(true);
    await seedDatabase(prisma); // no explicit now → seeds relative to the global clock
    expect(close(await getClockOffsetMs(), 2 * DAY)).toBe(true); // survives the reseed
    const seeded = await prisma.appSetting.findUniqueOrThrow({ where: { key: "seededAt" } });
    expect(close(new Date(seeded.value), await now())).toBe(true);
  });

  it("Fast-forward ends the squad's event for everyone: clock → just after it ends, every squad chat there archived", async () => {
    await seedDatabase(prisma);
    await setSetting("simFillMs", "0");
    const party = await squadFor("ev-indie-guild");
    const ev = party.event!;
    const r = await fastForward("p01");
    expect(r.ok).toBe(true);
    // jumped to the end of *this* event (+1 min), not days ahead
    expect(close(await now(), ev.endsAt.getTime() + 60_000)).toBe(true);
    const chat = await prisma.chat.findUniqueOrThrow({ where: { id: party.chat!.id } });
    expect(chat.archived).toBe(true);
    // the rest of the weekend is still ahead on the same clock
    expect(await prisma.event.count({ where: { kind: "event", startsAt: { gt: await now() } } })).toBeGreaterThan(0);
  });

  it("regression (live test): after Fast-forward, a second 'any event' queue still forms a squad", async () => {
    await seedDatabase(prisma);
    await setSetting("simFillMs", "0");
    await squadFor("ev-indie-guild");
    await fastForward("p01");
    await joinQueue("p01", { eventId: null, targetSize: 3, landmarkId: "lm-downtown-pa", locationSource: "manual" });
    await wait(300);
    expect(await tickAndAccept()).toBe(1);
    const second = await prisma.party.findFirstOrThrow({ where: { status: "confirmed" }, orderBy: { createdAt: "desc" }, include: { event: true } });
    expect(second.event!.startsAt.getTime()).toBeGreaterThan((await now()).getTime());
    expect(await prisma.party.count({ where: { status: "cancelled" } })).toBe(0);
  });
  it("rehearsal loop: Fast-forward past Indie Night → Reset & reseed → Indie Night is upcoming again, same clock", async () => {
    await seedDatabase(prisma);
    await setSetting("simFillMs", "0");
    await squadFor("ev-indie-guild");
    await fastForward("p01");
    const before = await getClockOffsetMs();
    await seedDatabase(prisma); // Reset & reseed
    expect(await getClockOffsetMs()).toBe(before); // the clock was not reset
    const ev = await prisma.event.findUniqueOrThrow({ where: { id: "ev-indie-guild" } });
    const t = await now();
    expect(ev.startsAt.getTime()).toBeGreaterThan(t.getTime());
    const { start, end } = weekendRange(t);
    expect(ev.startsAt >= start && ev.startsAt < end).toBe(true); // "this weekend" = the reseeded one
    await setSetting("simFillMs", "0");
    await squadFor("ev-indie-guild"); // the scripted demo works again
  });
});
