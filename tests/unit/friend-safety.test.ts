import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { friendAllowed, suggestFriends, type FriendSubject } from "@/lib/match/friendSafety";
import { AGE_BANDS, isMinorBand } from "@/lib/domain/enums";
import { prisma } from "@/lib/db";
import { seedDatabase } from "@/lib/seed/seed";
import { listSuggestions } from "@/lib/server/friends";

const worldArb = fc.integer({ min: 3, max: 40 }).chain((n) =>
  fc.record({
    bands: fc.array(fc.constantFrom(...AGE_BANDS), { minLength: n, maxLength: n }),
    edges: fc.array(fc.tuple(fc.nat(n - 1), fc.nat(n - 1)), { maxLength: n * 3 }),
    blocks: fc.array(fc.tuple(fc.nat(n - 1), fc.nat(n - 1)), { maxLength: n }),
    mates: fc.array(fc.nat(n - 1), { maxLength: 8 }),
    me: fc.nat(n - 1),
  }),
);

describe("friend suggestion safety (property)", () => {
  it("never crosses minor/adult and never includes blocked users", () => {
    let total = 0;
    fc.assert(
      fc.property(worldArb, (w) => {
        const people = new Map<string, FriendSubject>(w.bands.map((b, i) => [`u${i}`, { id: `u${i}`, ageBand: b, blocked: new Set<string>() }]));
        for (const [a, b] of w.blocks) if (a !== b) {
          people.get(`u${a}`)!.blocked.add(`u${b}`);
          people.get(`u${b}`)!.blocked.add(`u${a}`);
        }
        const friends = new Map<string, Set<string>>();
        for (const [a, b] of w.edges) if (a !== b) {
          (friends.get(`u${a}`) ?? friends.set(`u${a}`, new Set()).get(`u${a}`)!).add(`u${b}`);
          (friends.get(`u${b}`) ?? friends.set(`u${b}`, new Set()).get(`u${b}`)!).add(`u${a}`);
        }
        const me = people.get(`u${w.me}`)!;
        const out = suggestFriends(me, people, friends, new Set(w.mates.map((m) => `u${m}`)), 50);
        total += out.length;
        for (const s of out) {
          const other = people.get(s.id)!;
          expect(isMinorBand(other.ageBand as never)).toBe(isMinorBand(me.ageBand as never));
          expect(me.blocked.has(s.id) || other.blocked.has(me.id)).toBe(false);
          expect(s.id).not.toBe(me.id);
          expect(friends.get(me.id)?.has(s.id) ?? false).toBe(false);
        }
      }),
      { numRuns: 300 },
    );
    expect(total).toBeGreaterThan(100); // non-vacuous
  });

  it("friendAllowed examples", () => {
    const P = (id: string, ageBand: string, blocked: string[] = []) => ({ id, ageBand, blocked: new Set(blocked) });
    expect(friendAllowed(P("a", "16-17"), P("b", "18-24"))).toBe(false);
    expect(friendAllowed(P("a", "13-15"), P("b", "16-17"))).toBe(true);
    expect(friendAllowed(P("a", "18-24"), P("b", "25+"))).toBe(true);
    expect(friendAllowed(P("a", "18-24", ["b"]), P("b", "25+"))).toBe(false);
  });

  it("seeded suggestions for Me exclude the user Me blocked", async () => {
    await seedDatabase(prisma, { now: new Date() });
    const s = await listSuggestions("p01", 50);
    expect(s.length).toBeGreaterThan(0);
    expect(s.map((x) => x.id)).not.toContain("p09");
  });
});
