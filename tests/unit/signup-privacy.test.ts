import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { seedDatabase } from "@/lib/seed/seed";
import { createSampleLiveUser, deleteLiveUser, isAdultBand, sweepExpiredSignups, SIGNUP_TTL_MS } from "@/lib/server/signup";

describe("/join keeps its promise: 18+, deleted after 24h or on request", () => {
  beforeAll(async () => {
    await seedDatabase(prisma, { now: new Date() });
  });

  it("only adult bands may sign up or queue", () => {
    expect(isAdultBand("18-24")).toBe(true);
    expect(isAdultBand("25+")).toBe(true);
    expect(isAdultBand("16-17")).toBe(false);
    expect(isAdultBand("13-15")).toBe(false);
  });

  it("sweeps live sign-ups older than 24h, keeps newer ones and never touches seeded personas", async () => {
    const old = await createSampleLiveUser(prisma, { name: "Old Judge", ageBand: "25+", gender: null, womenOnlyParty: false });
    const fresh = await createSampleLiveUser(prisma, { name: "New Judge", ageBand: "18-24", gender: null, womenOnlyParty: false });
    await prisma.user.update({ where: { id: old.userId }, data: { createdAt: new Date(Date.now() - SIGNUP_TTL_MS - 60_000) } });
    const seeded = await prisma.user.count({ where: { isLive: false } });
    expect(await sweepExpiredSignups(prisma)).toBe(1);
    expect(await prisma.user.findUnique({ where: { id: old.userId } })).toBeNull();
    expect(await prisma.deviceSession.count({ where: { userId: old.userId } })).toBe(0);
    expect(await prisma.user.findUnique({ where: { id: fresh.userId } })).not.toBeNull();
    expect(await prisma.user.count({ where: { isLive: false } })).toBe(seeded);
  });

  it("delete me now removes a live user and their data, but refuses seeded personas", async () => {
    const u = await createSampleLiveUser(prisma, { name: "Gone Soon", ageBand: "18-24", gender: null, womenOnlyParty: false });
    expect(await prisma.tasteProfile.count({ where: { userId: u.userId } })).toBe(1);
    expect(await deleteLiveUser(prisma, u.userId)).toBe(true);
    expect(await prisma.user.findUnique({ where: { id: u.userId } })).toBeNull();
    expect(await prisma.tasteProfile.count({ where: { userId: u.userId } })).toBe(0);
    expect(await deleteLiveUser(prisma, "p01")).toBe(false);
    expect(await prisma.user.findUnique({ where: { id: "p01" } })).not.toBeNull();
  });
});
