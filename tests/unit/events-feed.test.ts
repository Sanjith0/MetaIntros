import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { seedDatabase } from "@/lib/seed/seed";
import { decorateEvents, filterFeed, NEARBY_KM, weekendRange } from "@/lib/server/events";

const NOW = new Date(2026, 10, 12, 9, 0); // Thu morning

describe("events feed", () => {
  let all: Awaited<ReturnType<typeof decorateEvents>>;
  beforeAll(async () => {
    await seedDatabase(prisma, { now: NOW });
    all = await decorateEvents("p01", await prisma.event.findMany());
  });

  it("For you = every upcoming event, most relevant first", () => {
    const f = filterFeed(all, "foryou", NOW);
    expect(f).toHaveLength(all.filter((e) => e.endsAt > NOW).length);
    expect(f.length).toBeGreaterThanOrEqual(25);
    const top3 = f.slice(0, 3).flatMap((e) => e.tagsList);
    expect(top3.some((t) => ["climbing", "bouldering", "indie-music", "vinyl"].includes(t))).toBe(true);
  });

  it("This weekend = Fri–Sun only", () => {
    const { start, end } = weekendRange(NOW);
    const f = filterFeed(all, "weekend", NOW);
    expect(f.length).toBeGreaterThan(15);
    for (const e of f) {
      expect(e.startsAt >= start && e.startsAt < end).toBe(true);
      expect([5, 6, 0]).toContain(e.startsAt.getDay());
    }
    expect(f.map((e) => e.id)).not.toContain("ev-climb-comp"); // next Thursday
    expect(f.map((e) => e.id)).not.toContain("ev-design-crit"); // this Thursday
  });

  it("Nearby = within radius, closest first", () => {
    const f = filterFeed(all, "nearby", NOW);
    expect(f.length).toBeGreaterThan(5);
    expect(f.length).toBeLessThan(all.length);
    for (const e of f) expect(e.distanceKm!).toBeLessThanOrEqual(NEARBY_KM);
    for (let i = 1; i < f.length; i++) expect(f[i].distanceKm!).toBeGreaterThanOrEqual(f[i - 1].distanceKm!);
  });

  it("past events drop out", () => {
    const later = new Date(2026, 10, 15, 23, 0);
    expect(filterFeed(all, "foryou", later).every((e) => e.endsAt > later)).toBe(true);
  });

  it("counts friends interested from RSVPs", () => {
    expect(all.some((e) => e.friendsInterested > 0)).toBe(true);
  });
});
