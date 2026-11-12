import { describe, expect, it } from "vitest";
import { MockGraphSource } from "@/lib/graph/source";
import { buildTasteProfile, dislikeTags } from "@/lib/profile/builder";
import { cosine, EMBED_DIM, tagVector } from "@/lib/profile/embedding";
import { prisma } from "@/lib/db";
import { seedDatabase } from "@/lib/seed/seed";
import { loadPeople } from "@/lib/profile/load";

const src = new MockGraphSource();

describe("profile builder", () => {
  it("is deterministic for a fixed persona", () => {
    const g = src.getUser("p01");
    expect(JSON.stringify(buildTasteProfile(g))).toBe(JSON.stringify(buildTasteProfile(structuredClone(g))));
  });

  it("builds Me's profile with the indie/climbing core", () => {
    const p = buildTasteProfile(src.getUser("p01"));
    const tags = p.interestTags.map((t) => t.tag);
    for (const t of ["climbing", "bouldering", "indie-music", "live-music", "vinyl"]) expect(tags).toContain(t);
    expect(p.embedding).toHaveLength(EMBED_DIM);
    expect(p.availability.length).toBe(3);
    expect(p.likes[0].source).toBe("likes[0]");
  });

  it("captures explicit dislikes with their source field and removes them from interests", () => {
    const g = src.getUser("p73"); // planted nightlife outlier
    const p = buildTasteProfile(g);
    const dis = dislikeTags(p);
    expect(dis.has("indie-music")).toBe(true);
    expect(p.dislikes.every((d) => /^x_not_interested\[\d+\]$/.test(d.source))).toBe(true);
    expect(p.interestTags.map((t) => t.tag)).not.toContain("indie-music");
  });

  it("dislike beats a conflicting like", () => {
    const g = structuredClone(src.getUser("p01"));
    g.x_not_interested.data.push({ id: "x", name: "Pitchfork", category: "Musician/Band" });
    expect(buildTasteProfile(g).interestTags.map((t) => t.tag)).not.toContain("indie-music");
  });

  it("flags sensitive items and never uses them for matching", () => {
    for (const id of ["p03", "p18", "p33", "p52"]) {
      const p = buildTasteProfile(src.getUser(id));
      const all = [...p.likes, ...p.groups];
      expect(all.some((x) => x.sensitive)).toBe(true);
      expect(p.interestTags.some((t) => t.tag.startsWith("sensitive-"))).toBe(false);
    }
  });

  it("infers a social style", () => {
    const styles = new Set(src.listUserIds().map((id) => buildTasteProfile(src.getUser(id)).socialStyle));
    expect(styles.size).toBeGreaterThanOrEqual(3);
    expect(buildTasteProfile(src.getUser("p73")).socialStyle).toBe("big-crowd");
  });

  it("embeddings place related tags closer than unrelated ones", () => {
    expect(cosine(tagVector("climbing"), tagVector("bouldering"))).toBeGreaterThan(cosine(tagVector("climbing"), tagVector("ramen")));
  });

  it("is persisted by the seed and round-trips through loadPeople", async () => {
    await seedDatabase(prisma, { now: new Date(2026, 10, 12, 9) });
    expect(await prisma.tasteProfile.count()).toBe(80);
    const people = await loadPeople(prisma, ["p01", "p02"]);
    const me = people.get("p01")!;
    expect(me.profile).toEqual(buildTasteProfile(src.getUser("p01")));
    expect(me.friends.has("p02")).toBe(true);
    expect([...(await loadPeople(prisma, ["p01"])).get("p01")!.blocked]).toEqual(["p09"]);
  });
});
