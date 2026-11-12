import { isMinorBand, type AgeBand } from "@/lib/domain/enums";

export interface FriendSubject {
  id: string;
  ageBand: string;
  blocked: Set<string>;
}

/** Friend suggestions/requests never cross the minor/adult line and never involve a block. */
export function friendAllowed(a: FriendSubject, b: FriendSubject): boolean {
  if (a.id === b.id) return false;
  if (isMinorBand(a.ageBand as AgeBand) !== isMinorBand(b.ageBand as AgeBand)) return false;
  if (a.blocked.has(b.id) || b.blocked.has(a.id)) return false;
  return true;
}

/**
 * People-you-may-know: friends-of-friends (ranked by mutual count) plus past squadmates,
 * filtered by friendAllowed. Pure so it can be property-tested.
 */
export function suggestFriends(
  me: FriendSubject,
  people: Map<string, FriendSubject>,
  friends: Map<string, Set<string>>,
  squadmates: Set<string> = new Set(),
  limit = 10,
): { id: string; mutual: number; squadmate: boolean }[] {
  const mine = friends.get(me.id) ?? new Set<string>();
  const score = new Map<string, number>();
  for (const f of mine) for (const ff of friends.get(f) ?? []) if (ff !== me.id && !mine.has(ff)) score.set(ff, (score.get(ff) ?? 0) + 1);
  for (const s of squadmates) if (s !== me.id && !mine.has(s) && !score.has(s)) score.set(s, 0);
  return [...score.entries()]
    .filter(([id]) => people.has(id) && friendAllowed(me, people.get(id)!))
    .map(([id, mutual]) => ({ id, mutual, squadmate: squadmates.has(id) }))
    .sort((a, b) => Number(b.squadmate) - Number(a.squadmate) || b.mutual - a.mutual || a.id.localeCompare(b.id))
    .slice(0, limit);
}
