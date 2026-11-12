import type { Bridge, Profile } from "@/contracts";
import { FRIENDS, GROUPS } from "@/fixtures";

/** Groups at or above this size are too big to count as a bridge. */
export const SMALL_GROUP_LIMIT = 200;

const adjacency = (() => {
  const m = new Map<string, Set<string>>();
  for (const [a, b] of FRIENDS) {
    if (!m.has(a)) m.set(a, new Set());
    if (!m.has(b)) m.set(b, new Set());
    m.get(a)!.add(b);
    m.get(b)!.add(a);
  }
  return m;
})();

export const friendsOf = (id: string): Set<string> => adjacency.get(id) ?? new Set();
export const areFriends = (a: string, b: string) => friendsOf(a).has(b);

export function mutualFriends(a: string, b: string): string[] {
  const fb = friendsOf(b);
  return [...friendsOf(a)].filter((x) => fb.has(x) && x !== a && x !== b).sort();
}

export function sharedSmallGroups(a: Profile, b: Profile) {
  return GROUPS.filter((g) => g.size < SMALL_GROUP_LIMIT && a.groupIds.includes(g.id) && b.groupIds.includes(g.id));
}

/** All bridges between two people: mutual friends and shared small Groups. */
export function bridgesBetween(a: Profile, b: Profile, nameOf: (id: string) => string): Bridge[] {
  const [x, y] = a.id < b.id ? [a, b] : [b, a];
  const out: Bridge[] = [];
  for (const m of mutualFriends(x.id, y.id)) {
    // The id must not carry the friend's id: it is shown as a source id on cards.
    out.push({ id: `br-${x.id}-${y.id}-f${tieHash(`${x.id}|${y.id}|${m}`)}`, a: x.id, b: y.id, kind: "mutual_friend", viaId: m, viaName: nameOf(m) });
  }
  for (const g of sharedSmallGroups(x, y)) {
    out.push({ id: `br-${x.id}-${y.id}-g-${g.id}`, a: x.id, b: y.id, kind: "group", viaId: g.id, viaName: g.name, groupSize: g.size });
  }
  return out;
}

export const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/** A short stable hash, so a tie can be cited without naming who it runs through. */
export function tieHash(s: string): string {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h.toString(36).slice(0, 6);
}
