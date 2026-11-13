/**
 * The human side of a profile: a person's own intro line, work, hometown, a few personality words
 * and how they come across. Seeded people get these from data/seed/people.json (via the Graph
 * payload's `about` and `x_profile`); live sign-ups have none, and every field is then empty.
 */
import { isSensitiveText } from "@/lib/cards/claims";

export interface Persona {
  about: string | null;
  work: string | null;
  hometown: string | null;
  traits: string[];
  /** third person, no gendered pronouns */
  voice: string | null;
}

export const EMPTY_PERSONA: Persona = { about: null, work: null, hometown: null, traits: [], voice: null };

const str = (v: unknown) => (typeof v === "string" && v.trim() && !isSensitiveText(v) ? v.trim() : null);

/** Read a persona from a stored Graph payload (User.rawGraph). Never throws. */
export function personaFrom(raw: unknown): Persona {
  if (!raw || typeof raw !== "object") return EMPTY_PERSONA;
  const g = raw as { about?: unknown; x_profile?: { work?: unknown; hometown?: unknown; traits?: unknown; voice?: unknown } };
  const x = g.x_profile && typeof g.x_profile === "object" ? g.x_profile : {};
  return {
    about: str(g.about),
    work: str(x.work),
    hometown: str(x.hometown),
    traits: Array.isArray(x.traits) ? x.traits.map(str).filter((t): t is string => Boolean(t)).slice(0, 3) : [],
    voice: str(x.voice),
  };
}

