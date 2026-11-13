/**
 * Companion briefs. A brief is everything a person's Companion agent knows about them, with a
 * share level per fact. Facts are built by code from the taste profile (ids are the same source
 * refs talk cards use, e.g. "p05:groups[1]"), so the model can describe facts but never add one.
 * Sensitive items never enter a brief.
 */
import { z } from "zod";
import { runAi, type AiSource } from "@/lib/ai";
import { isSensitiveText } from "@/lib/cards/claims";
import { isSensitiveTag } from "@/lib/graph/vocabulary";
import type { QueueMode } from "@/lib/match/engine";
import type { SocialStyle, SourcedItem } from "@/lib/profile/builder";
import type { Person } from "@/lib/profile/load";

export const SHARES = ["open", "need_only", "private"] as const;
export type Share = (typeof SHARES)[number];
export const isShare = (v: unknown): v is Share => typeof v === "string" && (SHARES as readonly string[]).includes(v);

export type FactKind = "interest" | "group" | "music" | "event" | "avoid" | "style";

export interface Fact {
  /** source ref, resolvable by lib/cards/claims.resolveSource */
  id: string;
  kind: FactKind;
  text: string;
  share: Share;
  depth?: string;
}

export interface Brief {
  ownerId: string;
  /** first name only */
  name: string;
  facts: Fact[];
  /** `note` is the person's own words for tonight: only their own Companion ever sees it. */
  tonight: { hopingFor: string; energy: SocialStyle; note?: string };
  /** how the person communicates, described in the third person */
  communication: string;
  lightsUp: string[];
  /** corrections and wants the person told their own Companion at a check-in (private to it) */
  told?: string[];
  source: AiSource | "template";
}

export interface QueueContext {
  mode: QueueMode;
  eventTitle: string | null;
  targetSize: number;
  /** "What do you want tonight?" in the person's own words (optional) */
  note?: string | null;
}

/** The model-written part of a brief (stored so it is generated once per person). */
export interface Generated {
  depth: Record<string, string>;
  communication: string;
  lightsUp: string[];
}

const FIELDS: { field: "likes" | "groups" | "music" | "eventHistory" | "dislikes"; ref: string; kind: FactKind }[] = [
  { field: "likes", ref: "likes", kind: "interest" },
  { field: "groups", ref: "groups", kind: "group" },
  { field: "music", ref: "music", kind: "music" },
  { field: "eventHistory", ref: "events", kind: "event" },
  { field: "dislikes", ref: "x_not_interested", kind: "avoid" },
];

const STYLE_TEXT: Record<SocialStyle, string> = {
  active: "Likes getting out and doing something active",
  chill: "Likes low-key, chill plans",
  "big-crowd": "Likes big lively crowds",
  "small-group": "Likes small-group hangs",
};

const firstName = (p: Pick<Person, "name">) => p.name.split(" ")[0];
/** Pronouns that assume a gender nobody stated. */
export const GENDERED = /\b(he|she|him|his|her|hers|himself|herself)\b/i;
const sensitive = (it: SourcedItem) => Boolean(it.sensitive || (it.tag && isSensitiveTag(it.tag)) || isSensitiveText(it.name));

/** Every non-sensitive fact about a person, with its share level. Pure and deterministic. */
export function sourceFacts(p: Person, shares: Record<string, Share> = {}): Fact[] {
  const out: Fact[] = [];
  for (const { field, ref, kind } of FIELDS) {
    p.profile[field].forEach((it, i) => {
      if (sensitive(it)) return;
      const id = `${p.id}:${ref}[${i}]`;
      out.push({ id, kind, text: it.name, share: shares[id] ?? (kind === "avoid" ? "need_only" : "open") });
    });
  }
  const styleId = `${p.id}:socialStyle`;
  out.push({ id: styleId, kind: "style", text: STYLE_TEXT[p.profile.socialStyle], share: shares[styleId] ?? "open" });
  return out;
}

/** How many open facts another Companion gets to see (keeps batched prompts small). */
export const MAX_OPEN_FACTS = 10;

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/** What other Companions may see: open facts only, and no text that repeats a private fact. */
export function openView(b: Brief) {
  const hidden = privateTexts(b).map(norm).filter(Boolean);
  const clean = (t: string | undefined) => (t && !hidden.some((h) => norm(t).includes(h)) && !isSensitiveText(t) ? t : undefined);
  return {
    id: b.ownerId,
    name: b.name,
    facts: b.facts
      .filter((f) => f.share === "open")
      .slice(0, MAX_OPEN_FACTS)
      .map((f) => ({ id: f.id, kind: f.kind, text: f.text, share: f.share, ...(clean(f.depth) ? { depth: f.depth } : {}) })),
    tonight: { hopingFor: b.tonight.hopingFor, energy: b.tonight.energy }, // never the person's own note
    communication: clean(b.communication) ?? "",
  };
}
export type OpenView = ReturnType<typeof openView>;

/** Text no other Companion may ever see or hear: private facts, and the person's own note for tonight. */
export const privateTexts = (b: Pick<Brief, "facts"> & { tonight?: { note?: string }; told?: string[] }) => [
  ...b.facts.filter((f) => f.share === "private").map((f) => f.text),
  ...(b.tonight?.note ? [b.tonight.note] : []),
  ...(b.told ?? []),
];

/** Clean a "what do you want tonight" sentence: null if empty, "sensitive" if it touches a sensitive topic. */
export function cleanNote(raw: unknown): string | null | "sensitive" {
  if (typeof raw !== "string") return null;
  const t = raw.replace(/\s+/g, " ").trim().slice(0, 200);
  if (!t) return null;
  return isSensitiveText(t) ? "sensitive" : t;
}

function hopingFor(ctx: QueueContext) {
  if (ctx.mode === "hangout") return `A new hangout with a squad of ${ctx.targetSize}`;
  return ctx.eventTitle ? `A squad of ${ctx.targetSize} for ${ctx.eventTitle}` : `A squad of ${ctx.targetSize} for an event this weekend`;
}

function templateGenerated(p: Person, facts: Fact[]): Generated {
  const style = STYLE_TEXT[p.profile.socialStyle].replace(/^Likes /, "");
  const voice = p.persona?.voice && !GENDERED.test(p.persona.voice) ? p.persona.voice : null;
  return {
    depth: {},
    communication: voice ?? `${firstName(p)} gravitates to ${style} and opens up fastest over a shared interest.`,
    lightsUp: facts.filter((f) => f.share === "open" && f.kind !== "style" && f.kind !== "avoid").slice(0, 2).map((f) => f.id),
  };
}

function assemble(p: Person, ctx: QueueContext, shares: Record<string, Share>, gen: Generated, source: Brief["source"]): Brief {
  const facts = sourceFacts(p, shares).map((f) => (gen.depth[f.id] ? { ...f, depth: gen.depth[f.id] } : f));
  const ids = new Set(facts.map((f) => f.id));
  return {
    ownerId: p.id,
    name: firstName(p),
    facts,
    tonight: { hopingFor: hopingFor(ctx), energy: p.profile.socialStyle, ...(ctx.note ? { note: ctx.note } : {}) },
    communication: gen.communication,
    lightsUp: gen.lightsUp.filter((id) => ids.has(id)),
    source,
  };
}

/** Deterministic brief (offline, tests, simulated-only rooms). */
export function templateBrief(p: Person, ctx: QueueContext, shares: Record<string, Share> = {}): Brief {
  return assemble(p, ctx, shares, templateGenerated(p, sourceFacts(p, shares)), "template");
}

/** Brief from stored model output. */
export function briefFromGenerated(p: Person, ctx: QueueContext, shares: Record<string, Share>, gen: Generated, source: Brief["source"]): Brief {
  const ids = new Set(sourceFacts(p).map((f) => f.id));
  const depth = Object.fromEntries(Object.entries(gen.depth).filter(([id]) => ids.has(id)));
  return assemble(p, ctx, shares, { ...gen, depth }, source);
}

const Out = z.object({
  depth: z.record(z.string(), z.string().max(200)).optional(),
  communication: z.string().min(5).max(300),
  lightsUp: z.array(z.string()).max(6).optional(),
});

/** Profile Analyst: one call. It may describe facts and the person's style; it cannot add facts. */
export async function generate(p: Person): Promise<{ gen: Generated; source: AiSource }> {
  const facts = sourceFacts(p);
  const tpl = templateGenerated(p, facts);
  const ai = await runAi({
    task: "companion_brief",
    system:
      "You are the Profile Analyst inside Facebook Events' Queue Up. You prepare a brief for one person's Companion agent, which will describe this person to other Companions. Using ONLY the listed facts, plus the person's own `intro` line and their `personality` (how they come across, when given): write `communication`, one or two sentences in the THIRD PERSON about how this person tends to socialise and talk, true to that personality; add `depth`, a short specific note for up to 5 facts where the facts themselves support it, keyed by fact id; and list in `lightsUp` up to 3 fact ids they would most enjoy talking about. Never invent facts. Refer to the person by first name or as \"they\"; never guess a gender or use he/she. Never mention or infer politics, religion, health or sexuality. JSON only: {\"communication\": \"...\", \"depth\": {\"<fact id>\": \"...\"}, \"lightsUp\": [\"<fact id>\"]}.",
    user: JSON.stringify({
      name: firstName(p),
      socialStyle: p.profile.socialStyle,
      ...(p.persona?.about ? { intro: p.persona.about } : {}),
      ...(p.persona?.voice ? { personality: { traits: p.persona.traits, voice: p.persona.voice } } : {}),
      facts: facts.map((f) => ({ id: f.id, kind: f.kind, text: f.text })),
    }),
    schema: Out,
    fallback: () => tpl,
    maxTokens: 700,
    temperature: 0.4,
    timeoutMs: 60_000,
  });
  const v = ai.value;
  const gen: Generated = { depth: v.depth ?? {}, communication: v.communication, lightsUp: v.lightsUp ?? [] };
  // A brief must not guess: no sensitive topics, and no gender inferred from a name.
  const bad = [gen.communication, ...Object.values(gen.depth)].some((t) => isSensitiveText(t) || GENDERED.test(t));
  return bad ? { gen: tpl, source: "fallback" } : { gen, source: ai.source };
}

export async function buildBrief(p: Person, ctx: QueueContext, opts: { useModel: boolean; shares?: Record<string, Share> }): Promise<Brief> {
  const shares = opts.shares ?? {};
  if (!opts.useModel) return templateBrief(p, ctx, shares);
  const { gen, source } = await generate(p);
  return briefFromGenerated(p, ctx, shares, gen, source);
}
