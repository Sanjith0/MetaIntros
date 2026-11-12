/**
 * Talk-card claims. Every claim cites the exact profile fields it came from
 * (e.g. "p01:likes[3]", "mutualFriends"); `validateCard` strips anything that doesn't resolve,
 * and anything touching a sensitive category, before a card is stored or shown.
 */
import type { SourcedItem, TasteProfileData } from "@/lib/profile/builder";
import { isSensitiveTag } from "@/lib/graph/vocabulary";
import { label } from "@/lib/agents/describe";

export type ClaimKind = "shared_interest" | "mutual_friends" | "event_overlap" | "pattern" | "spark";

export interface Claim {
  kind: ClaimKind;
  text: string;
  /** "<userId>:<field>[<i>]" | "mutualFriends" | "<userId>:socialStyle" | "precChat:<id>" */
  sources: string[];
}

export interface CardContent {
  claims: Claim[];
  openers: string[];
  generatedBy: "template" | "model";
  stripped?: number;
}

export interface CardSubject {
  id: string;
  name: string;
  profile: TasteProfileData;
  friends: Set<string>;
}

type Field = "likes" | "groups" | "music" | "eventHistory" | "dislikes";
const FIELD_ALIAS: Record<string, Field> = { likes: "likes", groups: "groups", music: "music", events: "eventHistory", eventHistory: "eventHistory", x_not_interested: "dislikes", dislikes: "dislikes" };

/** Words that flag a sensitive inference even if a source looks fine. */
export const SENSITIVE_PATTERNS = [
  /\b(democrat|republican|liberal|conservative|politic\w*|election|vote|voting|campaign|maga|leftist)\b/i,
  /\b(church|catholic|christian|bible|jewish|hillel|muslim|islam|mosque|synagogue|hindu|temple|faith|religio\w*|prayer|pray)\b/i,
  /\b(anxiety|depress\w*|diabet\w*|adhd|autis\w*|therapy|therapist|diagnos\w*|illness|disorder|medication|mental health|support group|cancer|pregnan\w*)\b/i,
  /\b(gay|lesbian|bisexual|queer|lgbt\w*|pride|transgender|trans\b|sexual\w*|orientation)\b/i,
];
export const isSensitiveText = (t: string) => SENSITIVE_PATTERNS.some((r) => r.test(t));

export function resolveSource(src: string, people: Map<string, CardSubject>): { ok: boolean; item?: SourcedItem } {
  if (src === "mutualFriends") return { ok: true };
  const m = src.match(/^([^:]+):(\w+)(?:\[(\d+)\])?$/);
  if (!m) return { ok: false };
  const p = people.get(m[1]);
  if (!p) return { ok: false };
  if (m[2] === "socialStyle" || m[2] === "availability") return { ok: m[3] === undefined };
  const field = FIELD_ALIAS[m[2]];
  if (!field || m[3] === undefined) return { ok: false };
  const item = p.profile[field][Number(m[3])];
  return item ? { ok: true, item } : { ok: false };
}

/** Strip ungrounded and sensitive claims/openers. Returns a new card + how many were removed. */
export function validateCard(card: CardContent, people: Map<string, CardSubject>): CardContent {
  let stripped = 0;
  const grounded = (c: Claim) => {
    if (!c.sources.length || isSensitiveText(c.text)) return false;
    return c.sources.every((s) => {
      if (s.startsWith("preChat:")) return true; // simulated spark; its pre-chat row is the source
      const r = resolveSource(s, people);
      return r.ok && !r.item?.sensitive && !(r.item?.tag && isSensitiveTag(r.item.tag));
    });
  };
  const claims = card.claims.filter(grounded);
  const openers = card.openers.filter((o) => !isSensitiveText(o));
  stripped = card.claims.length - claims.length + (card.openers.length - openers.length);
  return { ...card, claims, openers, stripped: (card.stripped ?? 0) + stripped };
}

function indexBy(items: SourcedItem[]) {
  const m = new Map<string, number[]>();
  items.forEach((it, i) => {
    if (!it.tag || it.sensitive) return;
    m.set(it.tag, [...(m.get(it.tag) ?? []), i]);
  });
  return m;
}

const fieldName: Record<Field, string> = { likes: "likes", groups: "groups", music: "music", eventHistory: "events", dislikes: "x_not_interested" };

/** First place a tag shows up in a profile, as a source ref + the human name. */
function firstRef(p: CardSubject, tag: string): { ref: string; name: string; field: Field } | null {
  for (const f of ["groups", "eventHistory", "likes", "music"] as const) {
    const i = p.profile[f].findIndex((x) => x.tag === tag && !x.sensitive);
    if (i >= 0) return { ref: `${p.id}:${fieldName[f]}[${i}]`, name: p.profile[f][i].name, field: f };
  }
  return null;
}

/** Deterministic, fully-grounded claims for `owner` looking at `subject`. */
export function buildClaims(owner: CardSubject, subject: CardSubject, nameOf: (id: string) => string): Claim[] {
  const claims: Claim[] = [];
  const ownerTags = new Set(owner.profile.interestTags.map((t) => t.tag));
  const shared = subject.profile.interestTags.filter((t) => ownerTags.has(t.tag) && !isSensitiveTag(t.tag)).slice(0, 4);
  const first = subject.name.split(" ")[0];
  for (const t of shared) {
    const a = firstRef(owner, t.tag), b = firstRef(subject, t.tag);
    if (!a || !b) continue;
    const via = b.field === "groups" ? `they're in ${b.name}` : b.field === "eventHistory" ? `they went to ${b.name}` : b.field === "music" ? `they listen to ${b.name}` : `they follow ${b.name}`;
    claims.push({ kind: "shared_interest", text: `You're both into ${label(t.tag).toLowerCase()} — ${via}.`, sources: [a.ref, b.ref] });
  }

  const mutual = [...owner.friends].filter((f) => subject.friends.has(f) && f !== owner.id && f !== subject.id).sort();
  if (mutual.length) {
    const names = mutual.slice(0, 3).map((id) => nameOf(id).split(" ")[0]);
    claims.push({ kind: "mutual_friends", text: `${mutual.length} mutual friend${mutual.length > 1 ? "s" : ""}: ${names.join(", ")}${mutual.length > 3 ? " and more" : ""}.`, sources: ["mutualFriends"] });
  }

  const oe = indexBy(owner.profile.eventHistory), se = indexBy(subject.profile.eventHistory);
  for (const [tag, si] of se) {
    const oi = oe.get(tag);
    if (!oi) continue;
    const sameEvent = owner.profile.eventHistory[oi[0]].name === subject.profile.eventHistory[si[0]].name;
    claims.push({
      kind: "event_overlap",
      text: sameEvent
        ? `You were both at ${subject.profile.eventHistory[si[0]].name}.`
        : `You've both been to ${label(tag).toLowerCase()} events (you: ${owner.profile.eventHistory[oi[0]].name}; ${first}: ${subject.profile.eventHistory[si[0]].name}).`,
      sources: [`${owner.id}:events[${oi[0]}]`, `${subject.id}:events[${si[0]}]`],
    });
    break;
  }

  const od = indexBy(owner.profile.dislikes), sd = indexBy(subject.profile.dislikes);
  const both = [...sd.keys()].find((t) => od.has(t));
  if (both) {
    claims.push({ kind: "pattern", text: `You both think about nights out similarly: neither of you is into ${label(both).toLowerCase()}.`, sources: [`${owner.id}:x_not_interested[${od.get(both)![0]}]`, `${subject.id}:x_not_interested[${sd.get(both)![0]}]`] });
  } else if (owner.profile.socialStyle === subject.profile.socialStyle) {
    const style = { active: "getting out and doing something active", chill: "low-key, chill plans", "big-crowd": "big lively crowds", "small-group": "small-group hangs" }[owner.profile.socialStyle];
    claims.push({ kind: "pattern", text: `You both think about weekends similarly: you both gravitate to ${style}.`, sources: [`${owner.id}:socialStyle`, `${subject.id}:socialStyle`] });
  }
  return claims;
}

export function templateOpeners(owner: CardSubject, subject: CardSubject, claims: Claim[]): string[] {
  const first = subject.name.split(" ")[0];
  const out: string[] = [];
  const si = claims.filter((c) => c.kind === "shared_interest");
  const tagOf = (c: Claim) => c.text.match(/into (.+?) —/)?.[1];
  if (si[0]) out.push(`${first}, how did you get into ${tagOf(si[0])}?`);
  if (si[1]) out.push(`What's your go-to spot for ${tagOf(si[1])} around here?`);
  const ev = claims.find((c) => c.kind === "event_overlap");
  if (ev) out.push("Wait, have we been at the same events before? Which was your favorite?");
  if (out.length < 2) out.push("What are you most looking forward to tonight?");
  void owner;
  return out.slice(0, 3);
}
