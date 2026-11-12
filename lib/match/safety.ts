/**
 * Hard safety rules. These are enforced in code and are NEVER relaxed by search widening,
 * and are re-checked after any LLM agent proposes a group or event.
 */
import { MAX_PARTY_SIZE, MIN_PARTY_SIZE, matchBand } from "@/lib/domain/enums";

export interface SafetySubject {
  id: string;
  ageBand: string;
  gender: string | null;
  womenOnlyParty: boolean;
  blocked: Set<string>;
}

export interface VenueLike {
  id: string;
  isPublicVenue: boolean;
}

export type Violation =
  | { rule: "age_band"; detail: string }
  | { rule: "women_only"; detail: string }
  | { rule: "blocked"; detail: string }
  | { rule: "public_venue"; detail: string }
  | { rule: "size"; detail: string }
  | { rule: "duplicate"; detail: string };

/** Can these two people ever be in the same party? */
export function pairAllowed(a: SafetySubject, b: SafetySubject): boolean {
  if (a.id === b.id) return false;
  if (matchBand(a.ageBand) !== matchBand(b.ageBand)) return false; // minors never with adults; all adults (18+) are one group
  if (a.blocked.has(b.id) || b.blocked.has(a.id)) return false;
  if (a.womenOnlyParty && b.gender !== "woman") return false;
  if (b.womenOnlyParty && a.gender !== "woman") return false;
  return true;
}

/** Full validation of a proposed party (+ optional event). Returns every violation found. */
export function validateParty(members: SafetySubject[], event?: VenueLike | null): { ok: boolean; violations: Violation[] } {
  const v: Violation[] = [];
  if (members.length < MIN_PARTY_SIZE || members.length > MAX_PARTY_SIZE) {
    v.push({ rule: "size", detail: `party has ${members.length} members` });
  }
  const ids = new Set<string>();
  for (const m of members) {
    if (ids.has(m.id)) v.push({ rule: "duplicate", detail: `${m.id} appears twice` });
    ids.add(m.id);
  }
  const bands = new Set(members.map((m) => matchBand(m.ageBand)));
  if (bands.size > 1) v.push({ rule: "age_band", detail: `mixed age bands: ${[...bands].sort().join(", ")}` });
  if (members.some((m) => m.womenOnlyParty)) {
    const notWomen = members.filter((m) => m.gender !== "woman");
    if (notWomen.length) v.push({ rule: "women_only", detail: `women-only member grouped with ${notWomen.map((m) => m.id).join(", ")}` });
  }
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const a = members[i], b = members[j];
      if (a.blocked.has(b.id) || b.blocked.has(a.id)) v.push({ rule: "blocked", detail: `${a.id} ↔ ${b.id}` });
    }
  }
  if (event && !event.isPublicVenue) v.push({ rule: "public_venue", detail: `${event.id} is not a public venue` });
  return { ok: v.length === 0, violations: v };
}

/** A party is women-only iff any member requested it (validateParty then guarantees all are women). */
export const isWomenOnlyParty = (members: SafetySubject[]) => members.some((m) => m.womenOnlyParty);
