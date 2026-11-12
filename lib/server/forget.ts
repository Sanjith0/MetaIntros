import { flag } from "@/lib/flags";
import { profile, store } from "./store";

/**
 * "Forget my night". After the plan is set (or no plan was found), a member
 * can delete everything private the night stored about them: their
 * sentence and rules, their agent's private reasons and preferences, the
 * exact prompts, code's checks of their rules, their receipt, and the
 * private projector traces about them. Then code scans every value in the
 * server's store for their words, and reports what it found (expected:
 * nothing). Kept: what they chose to share (approved lines at the table,
 * chat messages), the plan and their RSVP, and their profile.
 */

export interface ForgetResult {
  partyId: string;
  removed: { label: string; count: number }[];
  /** Every string value the scan read. */
  checked: number;
  /** Anything of theirs still found (expected empty). */
  found: { where: string; text: string }[];
}

const SKIP = new Set(["profiles", "events"]); // fixture data: the app's people and events, not tonight's

/** Walk every string in the store (Maps, Sets, arrays, objects) and report where any phrase appears. */
export function scanStore(phrases: string[], skip: Set<string> = SKIP): { checked: number; found: { where: string; text: string }[] } {
  const s = store() as unknown as Record<string, unknown>;
  let checked = 0;
  const found: { where: string; text: string }[] = [];
  const seen = new WeakSet<object>();
  const walk = (v: unknown, where: string) => {
    if (typeof v === "string") {
      checked++;
      for (const p of phrases) if (v.includes(p)) found.push({ where, text: p });
      return;
    }
    if (!v || typeof v !== "object") return;
    if (seen.has(v)) return;
    seen.add(v);
    if (v instanceof Map) {
      for (const [k, x] of v) {
        walk(k, `${where}{key}`);
        walk(x, `${where}[${String(k)}]`);
      }
    } else if (v instanceof Set) {
      let i = 0;
      for (const x of v) walk(x, `${where}{${i++}}`);
    } else if (Array.isArray(v)) {
      v.forEach((x, i) => walk(x, `${where}[${i}]`));
    } else {
      for (const [k, x] of Object.entries(v)) walk(x, `${where}.${k}`);
    }
  };
  for (const [k, v] of Object.entries(s)) if (!skip.has(k)) walk(v, k);
  return { checked, found };
}

export function canForget(partyId: string, userId: string): string | null {
  const party = store().parties.get(partyId);
  if (!flag("FORGET_ME")) return "Forgetting is turned off.";
  if (!party || !party.memberIds.includes(userId)) return "Not your party.";
  if (party.status !== "locked" && party.status !== "failed") return "While your party is still talking, use Leave instead.";
  if (store().forgotten.has(`${partyId}:${userId}`)) return "Already forgotten.";
  return null;
}

export function forgetNight(partyId: string, userId: string): ForgetResult {
  const why = canForget(partyId, userId);
  if (why) throw new Error(why);
  const s = store();
  const party = s.parties.get(partyId)!;
  const brief = s.briefs.get(`brief-${userId}`);

  // Their private words, captured before anything is deleted. A phrase that another member also owns is theirs too, so it stays.
  const othersOwn = new Set(
    party.memberIds
      .filter((id) => id !== userId)
      .flatMap((id) => [s.briefs.get(`brief-${id}`)?.sentence ?? "", ...(s.briefs.get(`brief-${id}`)?.hardRules.map((r) => r.sourceText) ?? []), ...s.verdicts.filter((v) => v.ownerId === id).map((v) => v.privateReason)]),
  );
  const phrases = [
    ...new Set([brief?.sentence ?? "", ...(brief?.hardRules.map((r) => r.sourceText) ?? []), ...s.verdicts.filter((v) => v.partyId === partyId && v.ownerId === userId).map((v) => v.privateReason)]),
  ].filter((p) => p.trim().length >= 6 && !othersOwn.has(p));

  const removed: ForgetResult["removed"] = [];
  const count = (label: string, n: number) => n && removed.push({ label, count: n });

  if (brief) {
    count("your sentence", brief.sentence ? 1 : 0);
    count("your rules", brief.hardRules.length);
    count("your preferences", brief.preferences.length);
    brief.sentence = "";
    brief.hardRules = [];
    brief.preferences = [];
  }
  const keep = <T>(arr: T[], drop: (x: T) => boolean): number => {
    const before = arr.length;
    const kept = arr.filter((x) => !drop(x));
    arr.splice(0, arr.length, ...kept);
    return before - kept.length;
  };
  count("your agent's private reasons", keep(s.verdicts, (v) => v.partyId === partyId && v.ownerId === userId));
  count("code's checks of your rules", keep(s.codeChecks, (c) => c.partyId === partyId && c.ownerId === userId));
  count("lines the verifier blocked", keep(s.blockedLines, (b) => b.partyId === partyId && b.ownerId === userId));
  count("private updates sent only to you", keep(s.events_log, (e) => e.type === "agent.verdict" && e.payload.partyId === partyId && e.payload.ownerId === userId));
  count("your receipt", s.receipts.delete(`${partyId}:${userId}`) ? 1 : 0);
  let prompts = 0;
  for (const k of [...s.prompts.keys()]) if (k.startsWith(`${partyId}:${userId}:`)) prompts += s.prompts.delete(k) ? 1 : 0;
  count("the exact prompts your agent got", prompts);

  // The projector's private lane about them, and any private trace that quoted them.
  let traces = 0;
  for (const t of s.traces) {
    if (t.partyId !== partyId || t.lane !== "private") continue;
    const quotes = phrases.some((p) => t.body.includes(p) || t.title.includes(p));
    if (t.actorId === userId || quotes) {
      t.body = `Forgotten at ${profile(userId).firstName}'s request.`;
      for (const p of phrases) t.title = t.title.split(p).join("…");
      traces++;
    }
  }
  count("private projector notes", traces);

  s.forgotten.add(`${partyId}:${userId}`);
  const scan = scanStore(phrases);
  return { partyId, removed, checked: scan.checked, found: scan.found };
}

export const isForgotten = (partyId: string, userId: string) => store().forgotten.has(`${partyId}:${userId}`);
