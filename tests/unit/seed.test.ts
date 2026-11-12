import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/db";
import { seedDatabase, weekendFriday, eventTimes, ME_ID } from "@/lib/seed/seed";
import { contentHash } from "@/lib/seed/hash";
import { generateAll, CLUSTERS } from "@/lib/seed/generate";
import { MockGraphSource } from "@/lib/graph/source";
import { GraphUser } from "@/lib/graph/schema";
import { isSensitiveTag, tagForName } from "@/lib/graph/vocabulary";
import { AgeBand } from "@/lib/domain/enums";

const NOW = new Date(2026, 10, 12, 9, 0); // Thu Nov 12 2026, 09:00 local
const source = new MockGraphSource();

const tagsOf = (g: GraphUser) => new Set(g.likes.data.map((l) => tagForName(l.name)).filter(Boolean) as string[]);

describe("persona generator", () => {
  it("is deterministic and matches the committed mock-graph files", () => {
    const a = generateAll();
    const b = generateAll();
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    for (const u of a.users) {
      const onDisk = JSON.parse(readFileSync(path.join("data/mock-graph/users", `${u.id}.json`), "utf8"));
      expect(onDisk).toEqual(u);
    }
    expect(JSON.parse(readFileSync("data/seed/chats.json", "utf8"))).toEqual(a.chats);
  });

  it("produces ~80 valid Graph-shaped personas aged 18–30", () => {
    const ids = source.listUserIds();
    expect(ids).toHaveLength(80);
    for (const id of ids) {
      const g = source.getUser(id); // throws if invalid
      expect(GraphUser.safeParse(g).success).toBe(true);
      const year = Number(g.birthday.slice(-4));
      expect(2026 - year).toBeGreaterThanOrEqual(18);
      expect(2026 - year).toBeLessThanOrEqual(30);
      expect(g.x_availability.data.length).toBeGreaterThan(0);
      expect(g.friends.data.length).toBeGreaterThan(0);
      expect(g.likes.data.length).toBeGreaterThan(0);
      for (const l of [...g.likes.data, ...g.x_not_interested.data]) expect(tagForName(l.name)).toBeDefined();
    }
  });

  it("has deliberate interest clusters (≥8 members sharing ≥3 core interests)", () => {
    const users = source.listUserIds().map((id) => source.getUser(id));
    for (const c of CLUSTERS) {
      const members = users.filter((u) => u.x_cluster === c.id);
      expect(members.length).toBeGreaterThanOrEqual(8);
      for (const m of members) {
        const shared = c.core.filter((t) => tagsOf(m).has(t));
        expect(shared.length, `${m.id} in ${c.id}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("friend graph is denser inside clusters than across", () => {
    const users = source.listUserIds().map((id) => source.getUser(id));
    const cl = new Map(users.map((u) => [u.id, u.x_cluster]));
    let inside = 0, across = 0, insidePairs = 0, acrossPairs = 0;
    for (const u of users) {
      for (const f of u.friends.data) {
        if (cl.get(f.id) === u.x_cluster) inside++;
        else across++;
      }
    }
    for (const a of users) {
      for (const b of users) {
        if (a.id >= b.id) continue;
        if (a.x_cluster === b.x_cluster) insidePairs++;
        else acrossPairs++;
      }
    }
    const densityIn = inside / 2 / insidePairs;
    const densityOut = across / 2 / acrossPairs;
    expect(densityIn).toBeGreaterThan(densityOut * 5);
    // friendship edges are symmetric
    const set = new Set(users.flatMap((u) => u.friends.data.map((f) => `${u.id}>${f.id}`)));
    for (const e of set) {
      const [a, b] = e.split(">");
      expect(set.has(`${b}>${a}`)).toBe(true);
    }
  });

  it("plants sensitive likes and dislike-conflict outliers for later safety tests", () => {
    const users = source.listUserIds().map((id) => source.getUser(id));
    const sensitive = users.filter((u) => [...tagsOf(u)].some(isSensitiveTag));
    expect(sensitive.length).toBeGreaterThanOrEqual(8);
    expect(sensitive.some((u) => u.x_cluster === "indie-climb")).toBe(true);
    const outliers = users.filter((u) => u.x_cluster === "outlier-nightlife");
    expect(outliers).toHaveLength(2);
    for (const o of outliers) {
      const dis = o.x_not_interested.data.map((d) => tagForName(d.name));
      expect(dis).toContain("indie-music");
    }
  });
});

describe("seedDatabase", () => {
  beforeAll(async () => {
    await seedDatabase(prisma, { now: NOW });
  });

  it("is idempotent (same counts + content hash on reseed)", async () => {
    const first = await contentHash(prisma);
    await seedDatabase(prisma, { now: NOW });
    const second = await contentHash(prisma);
    expect(second.counts).toEqual(first.counts);
    expect(second.hash).toBe(first.hash);
    expect(first.counts.user).toBe(80);
  });

  it("every persona has valid age band, availability and ≥1 friend", async () => {
    const users = await prisma.user.findMany({
      include: { availability: true, friendshipsA: true, friendshipsB: true },
    });
    for (const u of users) {
      expect(AgeBand.safeParse(u.ageBand).success).toBe(true);
      expect(["18-24", "25+"]).toContain(u.ageBand);
      expect(u.availability.length).toBeGreaterThan(0);
      for (const a of u.availability) expect(a.endMin).toBeGreaterThan(a.startMin);
      expect(u.friendshipsA.length + u.friendshipsB.length).toBeGreaterThan(0);
      expect(u.homeLat).not.toBeNull();
    }
  });

  it("designates exactly one 'Me' persona", async () => {
    const me = await prisma.user.findMany({ where: { isMe: true } });
    expect(me).toHaveLength(1);
    expect(me[0].id).toBe(ME_ID);
    expect(me[0].ageBand).toBe("18-24");
    expect(me[0].isSimulated).toBe(false);
  });

  it("indie-climb cluster has enough same-band members for an 8-person party with Me", async () => {
    const n = await prisma.user.count({ where: { cluster: "indie-climb", ageBand: "18-24" } });
    expect(n).toBeGreaterThanOrEqual(9);
  });

  it("seeds 8 landmarks and ~25 events, all public except the private house show", async () => {
    expect(await prisma.landmark.count()).toBe(8);
    const events = await prisma.event.findMany();
    expect(events.length).toBeGreaterThanOrEqual(25);
    const priv = events.filter((e) => !e.isPublicVenue);
    expect(priv.map((e) => e.id)).toEqual(["ev-house-show"]);
    for (const e of events) {
      expect(e.landmarkId).toBeTruthy();
      expect(e.endsAt.getTime()).toBeGreaterThan(e.startsAt.getTime());
      expect((e.tags as string[]).length).toBeGreaterThan(0);
    }
    expect(await prisma.eventRsvp.count()).toBeGreaterThan(50);
  });

  it("seeds Me's inbox with direct + group chats, some unread", async () => {
    const chats = await prisma.chat.findMany({
      where: { members: { some: { userId: ME_ID } } },
      include: { members: true, messages: true },
    });
    expect(chats.length).toBeGreaterThanOrEqual(10);
    expect(chats.some((c) => c.type === "group")).toBe(true);
    expect(chats.some((c) => c.type === "direct")).toBe(true);
    const unread = chats.filter((c) => {
      const me = c.members.find((m) => m.userId === ME_ID)!;
      return c.messages.some((m) => m.createdAt > me.lastReadAt && m.senderId !== ME_ID);
    });
    expect(unread.length).toBeGreaterThan(0);
  });

  it("seeds blocks including one by Me", async () => {
    expect(await prisma.block.count({ where: { blockerId: ME_ID } })).toBe(1);
  });
});

describe("event clock", () => {
  it("anchors to this weekend's Friday", () => {
    expect(weekendFriday(new Date(2026, 10, 12)).getDate()).toBe(13); // Thu → Fri 13
    expect(weekendFriday(new Date(2026, 10, 13, 12)).getDate()).toBe(13); // Fri → same
    expect(weekendFriday(new Date(2026, 10, 15)).getDate()).toBe(13); // Sun → back to Fri
    expect(weekendFriday(new Date(2026, 10, 16)).getDate()).toBe(20); // Mon → next Fri
  });
  it("computes event start/end", () => {
    const { startsAt, endsAt } = eventTimes(NOW, 1, "19:30", 180);
    expect(startsAt.getDay()).toBe(6);
    expect(startsAt.getHours()).toBe(19);
    expect(startsAt.getMinutes()).toBe(30);
    expect(endsAt.getHours()).toBe(22);
  });
});
