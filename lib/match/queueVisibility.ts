/**
 * Friends' queues: who may see which queue you're in. Pure, so it can be property-tested, and shared with
 * group queues (a group's lobby follows the same rules). Enforced on the server only: the API never returns
 * an entry the viewer isn't allowed to see.
 *
 * Rules (product decisions, Nov 12):
 * - opt-in: the owner's queueVisibility must be "friends" (default "off"), and the entry was queued visibly
 * - direct friends only, never friends of friends
 * - no mutual rule: the viewer's own setting doesn't matter
 * - a block in either direction hides it
 * - same age band only (the engine's backstop; Link itself is 18+)
 * - a women-only queue is only shown to women, the people who could join it
 */
import { pairAllowed, type SafetySubject } from "./safety";

export interface VisibilitySubject extends SafetySubject {
  queueVisibility: string;
}

export function canSeeQueue(viewer: VisibilitySubject, owner: VisibilitySubject, areFriends: boolean, entryVisible = true): boolean {
  if (viewer.id === owner.id) return false;
  if (!areFriends) return false;
  if (owner.queueVisibility !== "friends" || !entryVisible) return false;
  if (viewer.blocked.has(owner.id) || owner.blocked.has(viewer.id)) return false;
  if (viewer.ageBand !== owner.ageBand) return false;
  if (owner.womenOnlyParty && viewer.gender !== "woman") return false;
  return true;
}

export type CantJoinReason = "women_only" | "age_band" | "blocked";

/** Could the viewer be in the same squad as the owner? ("Queue up too" only promises the same queue.) */
export function canJoinFriendQueue(viewer: VisibilitySubject, owner: VisibilitySubject): { ok: true } | { ok: false; reason: CantJoinReason } {
  if (pairAllowed(viewer, owner)) return { ok: true };
  if (viewer.blocked.has(owner.id) || owner.blocked.has(viewer.id)) return { ok: false, reason: "blocked" };
  if (viewer.ageBand !== owner.ageBand) return { ok: false, reason: "age_band" };
  return { ok: false, reason: "women_only" };
}
