import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { mockProvider } from "@/lib/ai";
import { buildBrief, cleanNote, openView, privateTexts, sourceFacts, templateBrief } from "@/lib/companion/brief";
import { resolveSource } from "@/lib/cards/claims";
import { seedDatabase } from "@/lib/seed/seed";
import { getBriefFor, setShare } from "@/lib/server/briefs";
import { loadPeopleFromFiles } from "../helpers/people";

const people = loadPeopleFromFiles();
const me = people.get("p01")!;
const ctx = { mode: "events" as const, eventTitle: "Indie Night", targetSize: 5 };
const subjects = new Map([...people.values()].map((p) => [p.id, { id: p.id, name: p.name, profile: p.profile, friends: p.friends }]));

describe("companion brief", () => {
  beforeEach(() => mockProvider().reset());

  it("every fact id is a resolvable source ref and no fact is sensitive", () => {
    for (const p of people.values()) {
      const facts = sourceFacts(p);
      expect(facts.length).toBeGreaterThan(1);
      expect(new Set(facts.map((f) => f.id)).size).toBe(facts.length);
      for (const f of facts) {
        const r = resolveSource(f.id, subjects);
        expect(r.ok, f.id).toBe(true);
        expect(r.item?.sensitive ?? false).toBe(false);
      }
    }
  });

  it("dislikes default to need_only and overrides apply", () => {
    const facts = sourceFacts(me);
    expect(facts.filter((f) => f.kind === "avoid").every((f) => f.share === "need_only")).toBe(true);
    const first = facts[0].id;
    expect(sourceFacts(me, { [first]: "private" })[0].share).toBe("private");
  });

  it("openView and privateTexts split by share", () => {
    const b = templateBrief(me, ctx, { [sourceFacts(me)[0].id]: "private" });
    expect(openView(b).facts.length).toBeGreaterThan(0);
    expect(openView(b).facts.every((f) => f.share === "open")).toBe(true);
    expect(privateTexts(b)).toEqual([sourceFacts(me)[0].text]);
    expect(b.tonight.hopingFor).toContain("Indie Night");
    expect(b.name).toBe(me.name.split(" ")[0]);
  });

  it("the model can add depth but not facts", async () => {
    const id = sourceFacts(me)[0].id;
    mockProvider().on("companion_brief", () => JSON.stringify({ depth: { [id]: "goes most weekends", "p01:likes[999]": "invented" }, communication: "Asks a lot of questions and warms up fast.", lightsUp: [id, "nope"] }));
    const b = await buildBrief(me, ctx, { useModel: true });
    expect(b.source).toBe("mock");
    expect(b.facts.map((f) => f.id)).toEqual(sourceFacts(me).map((f) => f.id));
    expect(b.facts[0].depth).toBe("goes most weekends");
    expect(b.lightsUp).toEqual([id]);
    expect(JSON.stringify(b)).not.toContain("invented");
  });

  it("sensitive model text falls back to the template; useModel false makes no call", async () => {
    mockProvider().on("companion_brief", () => JSON.stringify({ depth: {}, communication: "Talks about church a lot.", lightsUp: [] }));
    expect((await buildBrief(me, ctx, { useModel: true })).communication).not.toMatch(/church/i);
    mockProvider().reset();
    expect((await buildBrief(me, ctx, { useModel: false })).source).toBe("template");
    expect(mockProvider().calls).toHaveLength(0);
  });

  it("the person's own note for tonight stays with their own Companion", () => {
    const note = "first night out since moving, not drinking";
    const b = templateBrief(me, { ...ctx, note });
    expect(b.tonight.note).toBe(note);
    expect(JSON.stringify(openView(b))).not.toContain("not drinking");
    expect(privateTexts(b)).toContain(note);
    expect(templateBrief(me, ctx).tonight).not.toHaveProperty("note");
    expect(cleanNote("  somewhere   quiet  ")).toBe("somewhere quiet");
    expect(cleanNote("")).toBeNull();
    expect(cleanNote("my therapist says go out more")).toBe("sensitive");
  });

  it("a brief that guesses a gender from a name is replaced by the template", async () => {
    mockProvider().on("companion_brief", () => JSON.stringify({ communication: "She has a chill, low-key style.", depth: {}, lightsUp: [] }));
    const b = await buildBrief(me, ctx, { useModel: true });
    expect(b.communication).not.toMatch(/\b(she|he|her|his)\b/i);
    expect(b.source).toBe("fallback");
    mockProvider().on("companion_brief", () => JSON.stringify({ communication: "Jordan warms up fast; they love the hero of a good story.", depth: {}, lightsUp: [] }));
    expect((await buildBrief(me, ctx, { useModel: true })).source).toBe("mock"); // "they" and words like "hero" are fine
    expect(mockProvider().calls[0].messages[0].content).toMatch(/never guess a gender/);
  });

  it("the Profile Analyst prompt never contains a sensitive item", async () => {
    mockProvider().on("companion_brief", () => JSON.stringify({ communication: "Easygoing and curious.", depth: {}, lightsUp: [] }));
    for (const p of people.values()) {
      if (![...p.profile.likes, ...p.profile.groups, ...p.profile.eventHistory].some((x) => x.sensitive)) continue;
      mockProvider().calls.length = 0;
      await buildBrief(p, ctx, { useModel: true });
      const prompt = mockProvider().calls[0].messages[1].content;
      for (const f of ["likes", "groups", "music", "eventHistory", "dislikes"] as const) {
        for (const it of p.profile[f]) if (it.sensitive) expect(prompt).not.toContain(it.name);
      }
    }
  });
});

describe("companion brief storage", () => {
  beforeEach(async () => {
    mockProvider().reset();
    await seedDatabase(prisma, { now: new Date() });
  });

  it("share choices persist and are validated", async () => {
    const id = (await getBriefFor("p01", ctx, false))!.facts[1].id;
    expect(await setShare("p01", id, "private")).toEqual({ ok: true });
    expect(await setShare("p01", "p01:likes[999]", "open")).toEqual({ ok: false, error: "unknown_fact" });
    expect(await setShare("p01", id, "loud")).toEqual({ ok: false, error: "bad_share" });
    expect((await getBriefFor("p01", ctx, false))!.facts[1].share).toBe("private");
  });

  it("the model writes a person's brief once, then it is reused", async () => {
    mockProvider().on("companion_brief", () => JSON.stringify({ communication: "Quick to laugh and quick to ask questions.", depth: {}, lightsUp: [] }));
    const a = await getBriefFor("p01", ctx, true);
    const b = await getBriefFor("p01", ctx, true);
    expect(a!.communication).toBe("Quick to laugh and quick to ask questions.");
    expect(b!.communication).toBe(a!.communication);
    expect(mockProvider().calls.filter((c) => c.task === "companion_brief")).toHaveLength(1);
  });
});
