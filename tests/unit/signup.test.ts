import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { seedDatabase } from "@/lib/seed/seed";
import { graphFromSignup, SignupInput } from "@/lib/signup";
import { GraphUser } from "@/lib/graph/schema";
import { buildTasteProfile } from "@/lib/profile/builder";
import { createLiveUser, createSampleLiveUser } from "@/lib/server/signup";

const valid = {
  name: "Taylor Judge",
  ageBand: "18-24",
  gender: "woman",
  womenOnlyParty: false,
  interests: ["climbing", "indie-music", "coffee", "film", "hiking"],
  dislikes: ["edm"],
  availability: ["sat-eve", "sun-pm"],
};

describe("live sign-up", () => {
  beforeAll(async () => {
    await seedDatabase(prisma, { now: new Date() });
  });

  it("validates input", () => {
    expect(SignupInput.safeParse(valid).success).toBe(true);
    expect(SignupInput.safeParse({ ...valid, interests: valid.interests.slice(0, 4) }).success).toBe(false);
    expect(SignupInput.safeParse({ ...valid, ageBand: "21" }).success).toBe(false);
    expect(SignupInput.safeParse({ ...valid, gender: "man", womenOnlyParty: true }).success).toBe(false);
    expect(SignupInput.safeParse({ ...valid, dislikes: ["climbing"] }).success).toBe(false);
    expect(SignupInput.safeParse({ ...valid, availability: [] }).success).toBe(false);
  });

  it("produces a valid Graph payload and a profile reflecting the chosen chips", () => {
    const g = graphFromSignup("live-x", SignupInput.parse(valid));
    expect(GraphUser.safeParse(g).success).toBe(true);
    const p = buildTasteProfile(g);
    expect(p.interestTags.map((t) => t.tag)).toEqual(expect.arrayContaining(valid.interests));
    expect(p.dislikes.map((d) => d.tag)).toEqual(["edm"]);
    expect(p.availability).toEqual([
      { dayOfWeek: 6, startMin: 1020, endMin: 1440 },
      { dayOfWeek: 0, startMin: 720, endMin: 1020 },
    ]);
  });

  it("creates a live user with profile, availability and its own session", async () => {
    const a = await createLiveUser(prisma, SignupInput.parse(valid));
    const b = await createLiveUser(prisma, SignupInput.parse({ ...valid, name: "Sam Judge", gender: "man" }));
    expect(a.sessionId).not.toBe(b.sessionId);
    const u = await prisma.user.findUniqueOrThrow({ where: { id: a.userId }, include: { tasteProfile: true, availability: true } });
    expect(u.isLive).toBe(true);
    expect(u.isSimulated).toBe(false);
    expect(u.ageBand).toBe("18-24");
    expect(u.tasteProfile).not.toBeNull();
    expect(u.availability).toHaveLength(2);
  });

  it("sample profile borrows a persona's interests under the live user's name", async () => {
    const r = await createSampleLiveUser(prisma, { name: "Alex Sample", ageBand: "25+", gender: null, womenOnlyParty: false });
    const u = await prisma.user.findUniqueOrThrow({ where: { id: r.userId }, include: { tasteProfile: true } });
    expect(u.name).toBe("Alex Sample");
    expect(u.ageBand).toBe("25+"); // self-declared band wins over the template
    expect((u.tasteProfile!.interestTags as { tag: string }[]).length).toBeGreaterThan(3);
    expect(await prisma.friendship.count({ where: { OR: [{ userAId: r.userId }, { userBId: r.userId }] } })).toBe(0);
  });
});
