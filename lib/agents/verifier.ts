import type { Brief } from "@/contracts";

/**
 * The verifier. A public line may only be built from:
 *  - the owner's approved shareable lines, or
 *  - the fixed list of neutral phrases below.
 * The text must be exactly those sources, in order, joined by spaces.
 * Anything else is blocked and replaced with a neutral phrase.
 */

export const NEUTRAL_PHRASES = {
  "neutral-hello": "Hi all, happy to be here.",
  "neutral-works": "That works for me.",
  "neutral-in": "I'm in.",
  "neutral-group": "Happy to go with the group.",
  "neutral-thinking": "Still thinking, give me a round.",
  "neutral-either": "A couple of these could work for me.",
  "neutral-excited": "Looking forward to meeting everyone.",
} as const;
export type NeutralId = keyof typeof NEUTRAL_PHRASES;
export const isNeutralId = (id: string): id is NeutralId => id in NEUTRAL_PHRASES;

export interface PublicLine {
  text: string;
  sourceIds: string[];
}

export type VerifyResult = { ok: true; line: PublicLine } | { ok: false; reason: string; line: PublicLine };

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();

/** Text for a list of source ids, or null if any id is not allowed. */
export function renderSources(sourceIds: string[], brief: Brief): string | null {
  const parts: string[] = [];
  for (const id of sourceIds) {
    if (isNeutralId(id)) {
      parts.push(NEUTRAL_PHRASES[id]);
      continue;
    }
    const line = brief.shareable.find((l) => l.id === id && l.approved);
    if (!line) return null;
    parts.push(line.text);
  }
  return parts.join(" ");
}

export function verifyPublicLine(line: PublicLine, brief: Brief, fallback: NeutralId = "neutral-works"): VerifyResult {
  const safe: PublicLine = { text: NEUTRAL_PHRASES[fallback], sourceIds: [fallback] };
  if (!line.sourceIds.length) return { ok: false, reason: "no sources", line: safe };
  if (line.sourceIds.length > 2) return { ok: false, reason: "too many sources", line: safe };
  const expected = renderSources(line.sourceIds, brief);
  if (expected === null) return { ok: false, reason: "a source is not an approved line or a neutral phrase", line: safe };
  if (norm(expected) !== norm(line.text)) return { ok: false, reason: "text is not built from its sources", line: safe };
  // Defence in depth: a public line can never contain private words.
  const lower = norm(line.text);
  if (norm(brief.sentence) && lower.includes(norm(brief.sentence))) return { ok: false, reason: "contains the private sentence", line: safe };
  for (const r of brief.hardRules) if (r.sourceText && lower.includes(norm(r.sourceText))) return { ok: false, reason: "contains a private rule", line: safe };
  return { ok: true, line: { text: expected, sourceIds: line.sourceIds } };
}
