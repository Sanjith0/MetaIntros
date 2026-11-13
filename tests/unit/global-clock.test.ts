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
import { createSampleLiveUser } from "@/lib/server/signup";

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
    const r = await fastForward();
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
    await fastForward();
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
    await fastForward();
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

describe("Fast-forward from /demo always finds a squad to end", () => {
  async function liveSquad(names: string[]) {
    await setSetting("fillMode", "live");
    const ids: string[] = [];
    for (const name of names) {
      const u = await createSampleLiveUser(prisma, { name, ageBand: "18-24", gender: null, womenOnlyParty: false });
      await joinQueue(u.userId, { eventId: "ev-indie-guild", targetSize: names.length, landmarkId: "lm-downtown-pa", locationSource: "manual" });
      ids.push(u.userId);
    }
    expect(await tickAndAccept()).toBe(1);
    return prisma.party.findFirstOrThrow({ where: { status: "confirmed", members: { some: { userId: ids[0] } } }, include: { chat: true, event: true } });
  }

  it("presenter not in any squad (live demo): ends the judges' squad event", async () => {
    await seedDatabase(prisma);
    const party = await liveSquad(["Ana", "Ben"]);
    const r = await fastForward(); // the presenter's /demo browser is Jordan, who isn't in this squad
    expect(r).toMatchObject({ ok: true, partyId: party.id, squads: 1, eventTitle: party.event!.title });
    expect((await prisma.chat.findUniqueOrThrow({ where: { id: party.chat!.id } })).archived).toBe(true);
    expect((await prisma.party.findUniqueOrThrow({ where: { id: party.id } })).status).toBe("completed");
  });

  it("ends the event that finishes soonest, one press at a time; 'no squad' when nothing is active", async () => {
    await seedDatabase(prisma);
    expect(await fastForward()).toEqual({ ok: false, error: "no squad" });
    await setSetting("simFillMs", "0");
    const indie = await liveSquad(["Cy", "Dee"]); // Saturday 7:30pm (judges', created first)
    await setSetting("fillMode", "simulated");
    const boulder = await squadFor("ev-boulder-social"); // Saturday 10am–12:30 (Jordan's): finishes first
    expect(boulder.event!.endsAt < indie.event!.endsAt).toBe(true);
    const first = await fastForward();
    expect(first.partyId).toBe(boulder.id);
    expect((await prisma.party.findUniqueOrThrow({ where: { id: indie.id } })).status).toBe("confirmed"); // untouched
    expect(indie.event!.startsAt.getTime()).toBeGreaterThan((await now()).getTime()); // clock didn't skip past it
    const second = await fastForward();
    expect(second.partyId).toBe(indie.id);
    expect(await fastForward()).toEqual({ ok: false, error: "no squad" });
  });
});
