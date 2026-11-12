import { nextId, nowIso, profile, store } from "./store";
import { partyForViewer } from "./social";

/**
 * Safety controls. Blocks are enforced by code when parties form (nobody you
 * blocked, or who blocked you, can land in your party). Reports go to a
 * review queue: the reported person is not told, and no report ever shows up
 * in the app as a count, a score or a label about anyone.
 */

export const REPORT_REASONS = [
  { id: "uncomfortable", label: "Made me uncomfortable" },
  { id: "unsafe", label: "I felt unsafe" },
  { id: "no-show", label: "Didn't show up" },
  { id: "spam", label: "Spam or selling something" },
  { id: "other", label: "Something else" },
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number]["id"];

/** People you have been in a party with (the only people you can report). */
export function partyPeople(userId: string): string[] {
  const s = store();
  const ids = new Set<string>();
  for (const p of s.parties.values()) if (p.memberIds.includes(userId)) for (const m of p.memberIds) if (m !== userId) ids.add(m);
  return [...ids];
}

export function setBlock(userId: string, subjectId: string, on: boolean) {
  if (userId === subjectId) throw new Error("You can't block yourself.");
  const me = profile(userId);
  profile(subjectId); // must exist
  me.blocks = on ? [...new Set([...me.blocks, subjectId])] : me.blocks.filter((id) => id !== subjectId);
  return me.blocks;
}

export function report(input: { reporterId: string; subjectId: string; reason: ReportReason; note?: string; alsoBlock?: boolean }) {
  if (!partyPeople(input.reporterId).includes(input.subjectId)) throw new Error("You can report people you've been in a party with.");
  const s = store();
  const r = {
    id: nextId("report"),
    reporterId: input.reporterId,
    subjectId: input.subjectId,
    partyId: partyForViewer(input.reporterId)?.id ?? null,
    reason: input.reason,
    note: (input.note ?? "").slice(0, 500),
    at: nowIso(),
  };
  s.reports.push(r);
  if (input.alsoBlock) setBlock(input.reporterId, input.subjectId, true);
  return { id: r.id, blocked: !!input.alsoBlock };
}
