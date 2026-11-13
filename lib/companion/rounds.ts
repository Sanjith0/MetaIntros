/**
 * Companion rounds. A Companion makes ONE model call per round and speaks to everyone it is
 * talking to in that round. Each call holds that Companion's own full brief plus public text
 * only (other people's open views, public thread lines, table rows) — never another person's
 * private facts. Every outgoing line passes the code checks in ./checks.
 *
 * Every round has a deterministic fallback with the same shape, used when the model is
 * unavailable, returns garbage, or skips a partner.
 */
import { z } from "zod";
import { runAi } from "@/lib/ai";
import { label } from "@/lib/agents/describe";
import { isSensitiveText } from "@/lib/cards/claims";
import { makePairScorer } from "@/lib/match/compat";
import { pairAllowed } from "@/lib/match/safety";
import type { SocialStyle } from "@/lib/profile/builder";
import type { Person } from "@/lib/profile/load";
import type { Brief, OpenView } from "./brief";
import { auditPrompt, safeMessage, type Msg } from "./checks";
import { MAX_PICKS, SIGN_OFF_FLOOR, makeResolver, setKey, type TableResponse, type TableRow, type Verdict } from "./orchestrator";

export interface RoundCtx {
  brief: Brief;
  me: Person;
  people: Map<string, Person>;
  /** other people's private fact texts, by person id (used only to audit prompts) */
  othersPrivate: Map<string, string[]>;
  useModel: boolean;
}

export interface ThreadMsg {
  from: string;
  to: string;
  kind: "intro" | "ask" | "answer" | "followup" | "close";
  say: string;
  cites: string[];
  blocked: boolean;
}

const SYSTEM =
  "You are a Companion agent inside Facebook Events' Queue Up. You represent ONE person (your_brief) to other people's Companions, to work out who would genuinely enjoy going out together. Rules: describe your person in the third person and never speak as them or imitate their voice; refer to every person by first name or as \"they\", never he or she, because nobody's gender has been stated; be honest, including about mismatches; use only facts in your_brief; facts with share \"open\" may be stated and cited by id; a \"need_only\" fact may be voiced only as a need (\"would prefer somewhere quieter\"), never as its reason; never state or hint at a \"private\" fact; never mention or infer politics, religion, health or sexuality. Reply with JSON only.";

const first = (p: Pick<Person, "name">) => p.name.split(" ")[0];
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/* ───────────────────────── fallbacks ───────────────────────── */

const SCENARIOS: ((n: string) => string)[] = [
  (n) => `It's 11pm, the music is loud and half the group wants to move on. What does ${n} do?`,
  (n) => `The plan falls through an hour before. How does ${n} react, and what would ${n} suggest instead?`,
  (n) => `${n} ends up next to someone they've never met. Does ${n} start the conversation, and what about?`,
  (n) => `The group can't agree on where to go next. Is ${n} the one who decides, or the one who goes along?`,
];

const REACTION: Record<SocialStyle, string> = {
  active: "suggest doing something rather than standing around",
  chill: "be happy to find a quieter corner and keep talking",
  "big-crowd": "be right in the middle of it",
  "small-group": "stick with a few people and go wherever they go",
};

const CHECK: Record<SocialStyle, string> = {
  active: "gets restless if a night is all sitting and talking",
  chill: "tends to fade in very loud, packed places",
  "big-crowd": "likes a lot going on and may want to keep moving",
  "small-group": "is at their best with a few people rather than a crowd",
};

const openFacts = (b: Brief) => b.facts.filter((f) => f.share === "open" && f.kind !== "style" && f.kind !== "avoid");

function refFor(p: Person, tag: string): string | null {
  for (const [field, ref] of [["groups", "groups"], ["eventHistory", "events"], ["likes", "likes"], ["music", "music"]] as const) {
    const i = p.profile[field].findIndex((x) => x.tag === tag && !x.sensitive);
    if (i >= 0) return `${p.id}:${ref}[${i}]`;
  }
  return null;
}

/** Deterministic verdict of `a`'s Companion on `b`, from the existing compatibility score. */
export function fallbackVerdict(a: Person, b: Person): Verdict {
  const score = clamp(makePairScorer()(a, b).score * 100);
  const bTags = new Set(b.profile.interestTags.map((t) => t.tag));
  const shared = a.profile.interestTags.filter((t) => bTags.has(t.tag)).map((t) => t.tag);
  const aAvoid = new Set(a.profile.dislikes.map((d) => d.tag).filter((t): t is string => Boolean(t)));
  const clash = b.profile.interestTags.find((t) => aAvoid.has(t.tag));
  const top = shared[0] ? label(shared[0]).toLowerCase() : null;
  const wouldEnjoy = top ? [shared[1] ? `Both into ${top} and ${label(shared[1]).toLowerCase()}` : `Both into ${top}`] : [`Similar idea of a good night out`];
  return {
    score,
    wouldEnjoy: wouldEnjoy.filter((t) => !isSensitiveText(t)),
    concerns: clash ? [`${first(b)} is into ${label(clash.tag).toLowerCase()}, which ${first(a)} tends to skip`].filter((t) => !isSensitiveText(t)) : [],
    needs: [],
    talkTopics: shared.slice(0, 2).flatMap((t) => [refFor(a, t), refFor(b, t)]).filter((x): x is string => Boolean(x)),
    opener: top && !isSensitiveText(top) ? `${first(b)}, how did you get into ${top}?` : `${first(b)}, what are you most looking forward to tonight?`,
    confidence: "medium",
  };
}

/* ───────────────────────── parsing helpers ───────────────────────── */


/** A model map keyed by partner (id or first name), or an array of {to|id|about, ...}. */
function byPartner(raw: unknown, resolve: (v: unknown) => string | null): Map<string, unknown> {
  const out = new Map<string, unknown>();
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const id = resolve((item as Record<string, unknown>)?.to ?? (item as Record<string, unknown>)?.id ?? (item as Record<string, unknown>)?.about);
      if (id && !out.has(id)) out.set(id, item);
    }
  } else if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      const id = resolve(k);
      if (id && !out.has(id)) out.set(id, v);
    }
  }
  return out;
}

/** Model line → checked message. Citations of other people's facts are dropped; a citation of this person's own non-open fact blocks the line. */
function line(c: RoundCtx, raw: unknown, fb: { say: string; cites: string[] }): Msg {
  const r = raw as { say?: unknown; cites?: unknown } | undefined;
  if (!r || typeof r.say !== "string" || !r.say.trim()) return safeMessage(c.brief, fb);
  const mine = new Set(c.brief.facts.map((f) => f.id));
  const cites = Array.isArray(r.cites) ? r.cites.filter((x): x is string => typeof x === "string" && mine.has(x)) : [];
  return safeMessage(c.brief, { say: r.say, cites });
}

const strs = (v: unknown, max: number) =>
  (Array.isArray(v) ? v : []).filter((x): x is string => typeof x === "string" && x.trim().length > 0 && !isSensitiveText(x)).map((x) => x.trim().slice(0, 160)).slice(0, max);

function coerceVerdict(raw: unknown, fb: Verdict, topics: Set<string>): Verdict {
  const fbTopics = fb.talkTopics.filter((t) => topics.has(t));
  if (!raw || typeof raw !== "object") return { ...fb, talkTopics: fbTopics };
  const r = raw as Record<string, unknown>;
  const n = Number(r.score);
  const wouldEnjoy = strs(r.wouldEnjoy ?? r.would_enjoy, 3);
  const talk = strs(r.talkTopics ?? r.talk_topics, 4).filter((t) => topics.has(t));
  const opener = typeof r.opener === "string" && r.opener.trim() && !isSensitiveText(r.opener) ? r.opener.trim().slice(0, 200) : fb.opener;
  return {
    score: Number.isFinite(n) ? clamp(n) : fb.score,
    wouldEnjoy: wouldEnjoy.length ? wouldEnjoy : fb.wouldEnjoy,
    concerns: strs(r.concerns, 2),
    needs: strs(r.needs, 2),
    talkTopics: talk.length ? talk : fbTopics,
    opener,
    confidence: r.confidence === "low" || r.confidence === "high" ? r.confidence : "medium",
  };
}

const topicsFor = (c: RoundCtx, view: OpenView | undefined) => new Set([...c.brief.facts.filter((f) => f.share === "open").map((f) => f.id), ...(view?.facts.map((f) => f.id) ?? [])]);

/** The brief as the model sees it. `source` is left out so prompts (and cache keys) don't depend on where a brief came from. */
const forPrompt = (b: Brief) => ({ ownerId: b.ownerId, name: b.name, facts: b.facts, tonight: { hopingFor: b.tonight.hopingFor, energy: b.tonight.energy }, communication: b.communication, lightsUp: b.lightsUp });

/** Only present when the person wrote something, so prompts (and cached replies) for everyone else are unchanged. */
const ownWords = (b: Brief) => ({
  ...(b.tonight.note
    ? { in_their_own_words: { text: b.tonight.note, how_to_use: "Your person wrote this about tonight. Weigh it heavily when judging fit, and voice what it implies as a need. Never quote or paraphrase it closely to anyone, and never reveal the reason behind it." } }
    : {}),
  ...(b.told?.length
    ? { your_person_told_you: { said: b.told, how_to_use: "Your person read your picks and told you this directly. It overrides anything you assumed about them: correct course, and never repeat it word for word to anyone." } }
    : {}),
});

interface Attributed {
  id: string;
  text: string;
}

async function round<T>(c: RoundCtx, task: string, payload: Record<string, unknown>, attributed: Attributed[], instruction: string, schema: z.ZodType<T>, empty: T, partners: number): Promise<{ data: T | null; source: string; audit: string[] }> {
  // Defense in depth: nothing attributed to another person may contain that person's private text.
  const audit = attributed.flatMap((a) => auditPrompt(a.text, c.othersPrivate.get(a.id) ?? []));
  if (audit.length) return { data: null, source: "blocked", audit };
  if (!c.useModel) return { data: null, source: "template", audit };
  const ai = await runAi({
    task,
    system: `${SYSTEM} ${instruction}`,
    user: JSON.stringify({ you_represent: c.brief.name, your_brief: forPrompt(c.brief), ...ownWords(c.brief), ...payload }),
    schema,
    fallback: () => empty,
    maxTokens: Math.min(6000, 400 * Math.max(1, partners) + 400),
    temperature: 0.4,
    timeoutMs: 60_000,
  });
  return { data: ai.source === "fallback" ? null : ai.value, source: ai.source, audit };
}

const say = (m: Pick<ThreadMsg, "from" | "kind" | "say">) => ({ from: m.from, kind: m.kind, say: m.say });

/* ───────────────────────── round 1: ask (the Companion who starts) ───────────────────────── */

export async function askRound(c: RoundCtx, intros: Map<string, OpenView>) {
  const partners = [...intros.keys()].sort();
  const resolve = makeResolver(partners, c.people);
  const r = await round(
    c, "companion_ask",
    { round: "ask", circle_mates: partners.map((id) => intros.get(id)) },
    partners.map((id) => ({ id, text: JSON.stringify(intros.get(id)) })),
    'Round: ASK. Read each circle-mate\'s introduction. For EACH circle-mate write one scenario question to their Companion that would reveal how their person actually behaves on a night out with yours (not a yes/no check of an interest). You may mention one of your person\'s open facts and cite its id. Max 40 words each. JSON only: {"asks": {"<circle-mate id>": {"say": "...", "cites": ["<your fact id>"]}}}.',
    z.object({ asks: z.any().optional() }), { asks: {} }, partners.length,
  );
  const got = byPartner(r.data?.asks, resolve);
  const asks = new Map<string, Msg>();
  partners.forEach((id, i) => asks.set(id, line(c, got.get(id), { say: SCENARIOS[i % SCENARIOS.length](intros.get(id)!.name), cites: [] })));
  return { asks, source: r.source, audit: r.audit };
}

/* ───────────────────────── objections ───────────────────────── */

/**
 * A reply that turns down something the other side suggested. `say` on the line is the Companion's
 * own guess ("not their thing"); `ifUp` is what it says instead if its person turns out to be up for it.
 * The room asks the real person before either is sent.
 */
export interface Objection {
  activity: string;
  ifUp: Msg;
}

const OBJECTION_RULE =
  'If an answer would turn down something their Companion suggested or asked about (an activity or kind of plan you think your person would not want), add to that answer "objection": {"activity": "<2-5 words naming it>", "ifUp": {"say": "<the same answer, written as if your person IS up for it>", "cites": []}}. Your "say" stays your honest guess. Your person will be asked which is true before anything is sent.';

function objectionOf(c: RoundCtx, raw: unknown): Objection | null {
  const o = (raw as { objection?: unknown } | undefined)?.objection as { activity?: unknown; ifUp?: unknown } | undefined;
  if (!o || typeof o.activity !== "string" || !o.activity.trim() || isSensitiveText(o.activity)) return null;
  const up = typeof o.ifUp === "string" ? { say: o.ifUp, cites: [] } : o.ifUp;
  const ifUp = line(c, up, { say: "", cites: [] });
  if (!ifUp.say.trim() || ifUp.blocked) return null;
  return { activity: o.activity.trim().slice(0, 60), ifUp };
}

/* ───────────────────────── round 2: reply (answer, then ask back) ───────────────────────── */

function fallbackAnswer(c: RoundCtx) {
  const f = openFacts(c.brief).slice(0, 2);
  const n = c.brief.name;
  if (!f.length) return { say: `${n} would go with the flow and see where the night goes.`, cites: [] };
  return { say: `${n} would probably ${REACTION[c.brief.tonight.energy]}. ${n} is into ${f.map((x) => x.text).join(" and ")}.`, cites: f.map((x) => x.id) };
}

/** Answer the question each partner's Companion asked first, then ask one back. */
export async function replyRound(c: RoundCtx, intros: Map<string, OpenView>, questions: Map<string, string>) {
  const partners = [...intros.keys()].sort();
  const resolve = makeResolver(partners, c.people);
  const r = await round(
    c, "companion_reply",
    { round: "reply", circle_mates: partners.map((id) => ({ ...intros.get(id), their_companion_asks: questions.get(id) ?? null })) },
    partners.map((id) => ({ id, text: JSON.stringify(intros.get(id)) + (questions.get(id) ?? "") })),
    `Round: REPLY. Each circle-mate's Companion just asked you a question about your person. For EACH: (1) answer it honestly in 40-80 words, citing your fact ids, replying to what they actually asked; (2) then ask ONE question back to their Companion (max 35 words), building on what they asked or told you, that would reveal how their person behaves on a night out with yours. ${OBJECTION_RULE} JSON only: {"replies": {"<circle-mate id>": {"answer": {"say": "...", "cites": [], "objection": null}, "ask": {"say": "...", "cites": []}}}}.`,
    z.object({ replies: z.any().optional() }), { replies: {} }, partners.length,
  );
  const got = byPartner(r.data?.replies, resolve);
  const answers = new Map<string, Msg>();
  const asks = new Map<string, Msg>();
  const objections = new Map<string, Objection>();
  partners.forEach((id, i) => {
    const g = got.get(id) as { answer?: unknown; ask?: unknown } | undefined;
    answers.set(id, line(c, g?.answer, fallbackAnswer(c)));
    asks.set(id, line(c, g?.ask, { say: SCENARIOS[(i + 1) % SCENARIOS.length](intros.get(id)!.name), cites: [] }));
    const o = objectionOf(c, g?.answer);
    if (o && !answers.get(id)!.blocked) objections.set(id, o);
  });
  return { answers, asks, objections, source: r.source, audit: r.audit };
}

/* ───────────────────────── round 3: answer + judge ───────────────────────── */

/**
 * Answer the questions asked back (only partners in `questions`), then give a private verdict on
 * EVERY partner, having seen the whole exchange (`threads`), and pick who to go deeper with.
 */
export async function answerRound(c: RoundCtx, intros: Map<string, OpenView>, questions: Map<string, string>, threads: Map<string, { from: string; say: string }[]> = new Map()) {
  const partners = [...intros.keys()].sort();
  const answering = partners.filter((id) => questions.has(id));
  const resolve = makeResolver(partners, c.people);
  const who = (from: string) => (from === c.me.id ? "you" : "them");
  const r = await round(
    c, "companion_answer",
    {
      round: "answer",
      circle_mates: partners.map((id) => ({
        ...intros.get(id),
        ...(threads.get(id)?.length ? { conversation_so_far: threads.get(id)!.map((l) => ({ from: who(l.from), say: l.say })) } : {}),
        their_companion_asks: questions.get(id) ?? null,
      })),
    },
    partners.map((id) => ({ id, text: JSON.stringify(intros.get(id)) + (questions.get(id) ?? "") + (threads.get(id) ?? []).filter((l) => l.from === id).map((l) => l.say).join("\n") })),
    `Round: ANSWER AND JUDGE. (1) For each circle-mate whose Companion asked you a question (their_companion_asks is not null), answer it honestly in about 40-80 words, citing your fact ids, replying to what they actually asked. ${OBJECTION_RULE} (2) For EVERY circle-mate, having read the whole conversation, give your PRIVATE verdict on how your person and theirs would get along: score 0-100, wouldEnjoy (1-2 short lines), concerns (0-2), needs (0-2), talkTopics (fact ids from either side), opener (one line your person could say to theirs), confidence (low|medium|high). The verdict is never shown to them. Then list in "picks" up to ${MAX_PICKS} ids you want a deeper conversation with. JSON only: {"answers": {"<id>": {"say": "...", "cites": [], "objection": null}}, "verdicts": {"<id>": {"score": 0, "wouldEnjoy": [], "concerns": [], "needs": [], "talkTopics": [], "opener": "", "confidence": "medium"}}, "picks": ["<id>"]}.`,
    z.object({ answers: z.any().optional(), verdicts: z.any().optional(), picks: z.any().optional() }), {}, partners.length,
  );
  const gotA = byPartner(r.data?.answers, resolve);
  const gotV = byPartner(r.data?.verdicts, resolve);
  const answers = new Map<string, Msg>();
  const objections = new Map<string, Objection>();
  const verdicts = new Map<string, Verdict>();
  for (const id of answering) {
    answers.set(id, line(c, gotA.get(id), fallbackAnswer(c)));
    const o = objectionOf(c, gotA.get(id));
    if (o && !answers.get(id)!.blocked) objections.set(id, o);
  }
  for (const id of partners) verdicts.set(id, coerceVerdict(gotV.get(id), fallbackVerdict(c.me, c.people.get(id)!), topicsFor(c, intros.get(id))));
  let picks = [...new Set((Array.isArray(r.data?.picks) ? r.data.picks : []).map(resolve).filter((x): x is string => Boolean(x)))].slice(0, MAX_PICKS);
  if (!r.data) picks = [...partners].sort((a, b) => verdicts.get(b)!.score - verdicts.get(a)!.score || a.localeCompare(b)).slice(0, 3);
  return { answers, objections, verdicts, picks, source: r.source, audit: r.audit };
}

/* ───────────────────────── deep dive ───────────────────────── */

const conversations = (c: RoundCtx, threads: Map<string, ThreadMsg[]>, partners: string[]) =>
  partners.map((id) => ({ with: id, name: first(c.people.get(id)!), thread: threads.get(id)!.map(say) }));
const attributedThreads = (threads: Map<string, ThreadMsg[]>, partners: string[]) =>
  partners.map((id) => ({ id, text: threads.get(id)!.filter((m) => m.from === id).map((m) => m.say).join("\n") }));

/** Exactly `size` members including the owner, all in the circle and all allowed with each other; model picks first, then the owner's highest-scored people. */
function repairGroup(c: RoundCtx, picked: string[], members: string[], verdicts: Map<string, Verdict>, size: number): string[] {
  const me = c.me.id;
  const ok = members.filter((id) => id !== me && pairAllowed(c.me, c.people.get(id)!));
  const okSet = new Set(ok);
  const scoreOf = (id: string) => verdicts.get(id)?.score ?? fallbackVerdict(c.me, c.people.get(id)!).score;
  const ranked = [...ok].sort((a, b) => scoreOf(b) - scoreOf(a) || a.localeCompare(b));
  const out: string[] = [];
  for (const id of [...picked, ...ranked]) {
    if (out.length >= size - 1) break;
    // everyone in a proposed group must be allowed with everyone else in it, not just with the owner
    if (okSet.has(id) && !out.includes(id) && out.every((x) => pairAllowed(c.people.get(x)!, c.people.get(id)!))) out.push(id);
  }
  return [me, ...out].sort();
}

export async function closeRound(c: RoundCtx, threads: Map<string, ThreadMsg[]>, members: string[], verdicts: Map<string, Verdict>, targetSize: number, withMe: string[] = []) {
  const partners = [...threads.keys()].sort();
  const mates = members.filter((id) => id !== c.me.id && pairAllowed(c.me, c.people.get(id)!)).sort();
  const resolveMate = makeResolver(mates, c.people);
  const resolveAny = makeResolver([...mates, c.me.id], c.people);
  const r = await round(
    c, "companion_close",
    {
      round: "close",
      squad_size: targetSize,
      conversations: conversations(c, threads, partners),
      circle: mates.map((id) => ({ id, name: first(c.people.get(id)!), your_score: verdicts.get(id)?.score ?? null })),
    },
    attributedThreads(threads, partners),
    `Round: GO DEEPER. For EACH person you are going deeper with: react to their answer, name one honest concern or possible mismatch between your person and theirs, and say plainly what your person would need for this to work (max 80 words); then give your updated private verdict. Then PROPOSE the squad you want for your person: exactly ${targetSize} people from the circle INCLUDING your own person, with a private reason and one public line (max 30 words). JSON only: {"says": {"<id>": {"say": "...", "cites": []}}, "verdicts": {"<id>": {"score": 0, "wouldEnjoy": [], "concerns": [], "needs": [], "talkTopics": [], "opener": "", "confidence": "medium"}}, "proposal": {"members": ["<id>"], "privateReason": "...", "line": {"say": "...", "cites": []}}}.`,
    z.object({ says: z.any().optional(), verdicts: z.any().optional(), proposal: z.any().optional() }), {}, Math.max(partners.length, 2),
  );
  const gotS = byPartner(r.data?.says, resolveMate);
  const gotV = byPartner(r.data?.verdicts, resolveMate);
  const says = new Map<string, Msg>();
  const updated = new Map<string, Verdict>();
  const n = c.brief.name;
  for (const id of partners) {
    says.set(id, line(c, gotS.get(id), { say: `${n} would be glad to meet ${first(c.people.get(id)!)}. What ${n} needs is a plan that leaves room to actually talk.`, cites: [] }));
    const base = verdicts.get(id) ?? fallbackVerdict(c.me, c.people.get(id)!);
    updated.set(id, gotV.has(id) ? coerceVerdict(gotV.get(id), base, new Set(base.talkTopics)) : base);
  }
  const merged = new Map([...verdicts, ...updated]);
  const p = (r.data?.proposal ?? {}) as { members?: unknown; privateReason?: unknown; line?: unknown };
  const picked = (Array.isArray(p.members) ? p.members : []).map(resolveAny).filter((x): x is string => Boolean(x));
  const proposal = {
    // the person's queue-together mates are always in their proposal
    members: repairGroup(c, [...withMe, ...picked], members, merged, targetSize),
    privateReason: typeof p.privateReason === "string" ? p.privateReason.slice(0, 300) : "",
    line: line(c, p.line, { say: `${n}'s Companion thinks this group would click.`, cites: [] }),
  };
  return { says, verdicts: updated, proposal, source: r.source, audit: r.audit };
}

/* ───────────────────────── deliberation ───────────────────────── */

export async function deliberate(c: RoundCtx, table: TableRow[], verdicts: Map<string, Verdict>, targetSize: number): Promise<TableResponse & { line: Msg; source: string; audit: string[] }> {
  const me = c.me.id;
  const rows = [...table].sort((a, b) => a.id.localeCompare(b.id));
  const circle = [...new Set(rows.flatMap((r) => r.members))];
  const scoreOf = (id: string) => verdicts.get(id)?.score ?? fallbackVerdict(c.me, c.people.get(id)!).score;
  const fits = (r: TableRow) => r.members.includes(me) && r.members.every((id) => id === me || pairAllowed(c.me, c.people.get(id)!));
  const mean = (r: TableRow) => {
    const others = r.members.filter((id) => id !== me);
    return others.length ? others.reduce((s, id) => s + scoreOf(id), 0) / others.length : 0;
  };
  // Cooperative by default: back someone else's proposal when it is nearly as good for this person as their own.
  const own = rows.find((x) => x.by === me);
  const best = rows.filter((x) => x.by !== me && fits(x)).sort((a, b) => mean(b) - mean(a) || a.id.localeCompare(b.id))[0];
  const fb: TableResponse = best && (!own || mean(best) >= mean(own) - 8) ? { action: "back", proposalId: best.id } : { action: "hold" };
  const fbLine = { say: fb.action === "back" ? `${c.brief.name}'s Companion is happy with that group.` : `${c.brief.name}'s Companion is staying with its own proposal for now.`, cites: [] };

  const r = await round(
    c, "companion_deliberate",
    { round: "deliberate", squad_size: targetSize, your_person_id: me, table: rows.map((x) => ({ id: x.id, by: x.by, members: [...x.members].sort(), says: x.line })) },
    rows.filter((x) => x.by !== me).map((x) => ({ id: x.by, text: x.line })),
    `Round: DELIBERATE. Every Companion's proposed squad is on the table. Choose ONE: "back" a proposal that includes your person (give its proposalId); "amend" (give the full member list you want, exactly ${targetSize} ids including your person); or "hold" to keep your own proposal. You never have to say why you don't want someone. Add one public line (max 25 words). JSON only: {"action": "back|amend|hold", "proposalId": "...", "members": ["<id>"], "line": {"say": "...", "cites": []}}.`,
    z.object({ action: z.any().optional(), proposalId: z.any().optional(), members: z.any().optional(), line: z.any().optional() }), {}, 3,
  );
  let out: TableResponse = fb;
  const d = r.data;
  if (d) {
    if (d.action === "hold") out = { action: "hold" };
    else if (d.action === "back") {
      const row = rows.find((x) => x.id === d.proposalId);
      if (row && fits(row)) out = { action: "back", proposalId: row.id };
    } else if (d.action === "amend") {
      const resolve = makeResolver([...circle, me], c.people);
      const picked = (Array.isArray(d.members) ? d.members : []).map(resolve).filter((x): x is string => Boolean(x));
      if (picked.length) {
        const members = repairGroup(c, picked, circle, verdicts, targetSize);
        const same = rows.find((x) => setKey(x.members) === setKey(members));
        out = same ? (same.by === me ? { action: "hold" } : { action: "back", proposalId: same.id }) : { action: "amend", proposalId: typeof d.proposalId === "string" ? d.proposalId : undefined, members };
      }
    }
  }
  return { ...out, line: line(c, d?.line, fbLine), source: r.source, audit: r.audit };
}

/* ───────────────────────── group conversation + sign-off ───────────────────────── */

/** One round: speak to the proposed squad about how it would work for your person, and decide. */
export async function groupRound(c: RoundCtx, members: string[], intros: Map<string, OpenView>, verdicts: Map<string, Verdict>) {
  const others = members.filter((id) => id !== c.me.id).sort();
  const scoreOf = (id: string) => verdicts.get(id)?.score ?? fallbackVerdict(c.me, c.people.get(id)!).score;
  const objection = others.some((id) => !pairAllowed(c.me, c.people.get(id)!) || scoreOf(id) < SIGN_OFF_FLOOR);
  const f = openFacts(c.brief)[0];
  const r = await round(
    c, "companion_group",
    { round: "group", squad: others.map((id) => ({ ...intros.get(id), your_score: verdicts.get(id)?.score ?? null })) },
    others.map((id) => ({ id, text: JSON.stringify(intros.get(id)) })),
    'The Orchestrator has proposed this squad. Round: SPEAK AND DECIDE. Speak to the whole group once (max 70 words): what your person hopes for from this night, what they would bring, and anything the group should know to make it work for them. Then decide for your person: "yes"; "yes_if" (put the one thing they would need in "need"); or "no". A "no" stays private: put the reason in "privateReason", it is never shown to anyone. JSON only: {"line": {"say": "...", "cites": []}, "decision": "yes|yes_if|no", "need": "", "privateReason": ""}.',
    z.object({ line: z.any().optional(), decision: z.any().optional(), need: z.any().optional(), privateReason: z.any().optional() }), {}, 2,
  );
  const d = r.data;
  const decision: "yes" | "yes_if" | "no" = d && (d.decision === "yes" || d.decision === "yes_if" || d.decision === "no") ? d.decision : objection ? "no" : "yes";
  const need = decision === "yes_if" && typeof d?.need === "string" && !isSensitiveText(d.need) ? d.need.trim().slice(0, 160) : "";
  const n = c.brief.name;
  return {
    line: line(c, d?.line, {
      say: `${n} is hoping for ${c.brief.tonight.hopingFor.replace(/^A /, "a ")}${f ? `, and would happily talk about ${f.text} all night` : ""}. ${n} ${CHECK[c.brief.tonight.energy]}.`,
      cites: f ? [f.id] : [],
    }),
    decision,
    need,
    privateReason: typeof d?.privateReason === "string" ? d.privateReason.slice(0, 300) : "",
    source: r.source,
    audit: r.audit,
  };
}
