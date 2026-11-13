/**
 * Code checks on everything a Companion says. A Companion may only cite its own person's open
 * facts, may never repeat a fact its person marked private, and may never touch a sensitive topic.
 */
import { isSensitiveText } from "@/lib/cards/claims";
import { privateTexts, type Brief } from "./brief";

export interface Msg {
  say: string;
  cites: string[];
  blocked: boolean;
  reason?: string;
}

export const NEUTRAL = "Happy to hear more about your person.";

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

export type CheckResult = { ok: true } | { ok: false; reason: "bad citation" | "private text" | "sensitive" };

export function checkMessage(b: Brief, say: string, cites: string[]): CheckResult {
  const open = new Set(b.facts.filter((f) => f.share === "open").map((f) => f.id));
  if (cites.some((c) => !open.has(c))) return { ok: false, reason: "bad citation" };
  const text = norm(say);
  if (privateTexts(b).some((p) => norm(p) && text.includes(norm(p)))) return { ok: false, reason: "private text" };
  if (isSensitiveText(say)) return { ok: false, reason: "sensitive" };
  return { ok: true };
}

/** The message if it passes the checks, else a neutral line marked blocked. */
export function safeMessage(b: Brief, raw: { say?: unknown; cites?: unknown } | undefined | null): Msg {
  const say = typeof raw?.say === "string" ? raw.say.trim().slice(0, 900) : "";
  if (!say) return { say: NEUTRAL, cites: [], blocked: true, reason: "empty" };
  const open = new Set(b.facts.filter((f) => f.share === "open").map((f) => f.id));
  const all = Array.isArray(raw?.cites) ? raw.cites.filter((c): c is string => typeof c === "string") : [];
  // A citation of something that is not this person's open fact is a leak attempt or a hallucination.
  const r = checkMessage(b, say, all);
  if (!r.ok) return { say: NEUTRAL, cites: [], blocked: true, reason: r.reason };
  return { say, cites: all.filter((c) => open.has(c)), blocked: false };
}

/** Private texts of OTHER people that made it into a prompt (must always be empty). */
export function auditPrompt(prompt: string, othersPrivate: string[]): string[] {
  const text = norm(prompt);
  return othersPrivate.filter((p) => norm(p) && text.includes(norm(p)));
}
