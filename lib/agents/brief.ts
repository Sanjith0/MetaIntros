import { z } from "zod";
import { Brief, Clock, HardRule, type Fact, type Preference, type ShareableLine } from "@/contracts";
import { callModel, type ModelSource } from "@/model/client";

/**
 * One sentence becomes:
 *  - hard rules (private, never shareable, enforced by code),
 *  - preferences (private, used for the 1-5 preference),
 *  - shareable lines the owner approves. Each line is backed by a fact the
 *    owner approves, so every public sentence maps to an approved fact id.
 */

/* ---------------------------- word numbers ---------------------------- */

const WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fifteen: 15, twenty: 20, "twenty-five": 25, "twenty five": 25,
  thirty: 30, forty: 40, fifty: 50, sixty: 60, hundred: 100,
};

function toNumber(raw: string): number | null {
  const s = raw.trim().toLowerCase().replace(/^\$/, "");
  if (/^\d+(\.\d+)?$/.test(s)) return Number(s);
  if (s in WORDS) return WORDS[s]!;
  const parts = s.split(/[\s-]+/);
  if (parts.length === 2 && parts[0]! in WORDS && parts[1]! in WORDS) return WORDS[parts[0]!]! + WORDS[parts[1]!]!;
  return null;
}

/** "eleven" -> "23:00", "10:30" -> "22:30", "midnight" -> "00:00". Evening by default. */
export function parseEvening(raw: string): string | null {
  const s = raw.trim().toLowerCase().replace(/\s*(pm|p\.m\.)$/, "");
  if (/midnight|twelve|^12$/.test(s)) return "00:00";
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?$/);
  let h: number | null = null;
  let min = 0;
  if (m) {
    h = Number(m[1]);
    min = m[2] ? Number(m[2]) : 0;
  } else {
    h = toNumber(s.replace(/\s*o'?clock$/, ""));
  }
  if (h === null || h < 1 || h > 23) return null;
  if (h < 12) h += 12;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/* -------------------------- deterministic parse -------------------------- */

const NUM = "(?:\\$?\\d+(?:\\.\\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty(?:[- ]five)?|thirty|forty|fifty|sixty|hundred)";

const END_BY = new RegExp(`\\b(?:out|home|done|back|leaving|leave|finished|wrapped up|in bed)\\s+(?:by|before)\\s+((?:\\d{1,2}(?::\\d{2})?\\s*(?:pm)?)|midnight|${NUM})`, "i");
const MAX_PRICE = new RegExp(
  `\\b(?:under|less than|below|up to|no more than|max(?:imum)?(?: of)?|budget(?: is| of| around| about)?|spending up to|spend up to|around)\\s+(${NUM})(?:\\s*(?:bucks|dollars|usd))?`,
  "i",
);
const NO_DRINK =
  /\b(?:nowhere|no ?where|not somewhere|no place|nothing)\s+(?:i|we|you)\s+(?:have|need|got)\s+to\s+drink\b|\bno drink(?:ing)? minimum\b|\bsober\b|\bdon'?t drink\b|\bno alcohol\b/i;
const PUBLIC = /\b(?:public place|somewhere public|public venue|in public)\b/i;

interface PrefSpec {
  tag: string;
  re: RegExp;
  line: string;
  ask: string;
}

/** The fixed catalogue of shareable lines. Nothing outside it is ever
 *  proposed, so a preference line cannot smuggle a hard rule out. */
export const PREFS: PrefSpec[] = [
  { tag: "chill", re: /\b(chill|low[- ]?key|relaxed|easygoing|mellow)\b/i, line: "Up for something low-key.", ask: "What's your ideal slow evening?" },
  { tag: "quiet", re: /\b(nothing too loud|not too loud|quiet|not loud|calm)\b/i, line: "Somewhere we can actually talk would be great.", ask: "What's a place you like for a good conversation?" },
  { tag: "music", re: /\b(music|band|dj|concert|gig)\b/i, line: "Would love some live music.", ask: "What have you been listening to?" },
  { tag: "outdoors", re: /\b(outdoors?|outside|open air|in the park)\b/i, line: "Happy to be outside.", ask: "Favourite spot outside in the city?" },
  { tag: "games", re: /\b(games?|board games?|trivia)\b/i, line: "Always up for a game.", ask: "What's a game you could play forever?" },
  { tag: "hands-on", re: /\b(hands[- ]on|make something|crafts?|workshop|build something)\b/i, line: "Into making things with my hands.", ask: "What have you made lately?" },
  { tag: "new", re: /\b(something new|try something|new things?|never done)\b/i, line: "Keen to try something new.", ask: "What's something new you tried this year?" },
  { tag: "social", re: /\b(meet (?:new )?people|social|make friends)\b/i, line: "Mostly here to meet people.", ask: "What brought you out tonight?" },
  { tag: "food", re: /\b(food|eat|dinner|snacks|hungry)\b/i, line: "Food is a big plus.", ask: "Best thing you've eaten this month?" },
  { tag: "open", re: /\b(open to anything|down for anything|up for anything)\b/i, line: "Open to anything.", ask: "What's the best spontaneous plan you've said yes to?" },
];

export interface ParsedBrief {
  hardRules: HardRule[];
  preferences: Preference[];
}

export function parseSentence(ownerId: string, sentence: string): ParsedBrief {
  const hardRules: HardRule[] = [];
  const end = sentence.match(END_BY);
  if (end) {
    const t = parseEvening(end[1]!);
    if (t) hardRules.push({ id: `hr-${ownerId}-end`, kind: "end_by", value: t, sourceText: end[0] });
  }
  const price = sentence.match(MAX_PRICE);
  if (price) {
    const n = toNumber(price[1]!);
    if (n !== null) hardRules.push({ id: `hr-${ownerId}-price`, kind: "max_price", value: n, sourceText: price[0] });
  }
  const drink = sentence.match(NO_DRINK);
  if (drink) hardRules.push({ id: `hr-${ownerId}-drink`, kind: "no_drink_minimum", value: true, sourceText: drink[0] });
  const pub = sentence.match(PUBLIC);
  if (pub) hardRules.push({ id: `hr-${ownerId}-public`, kind: "public_venue", value: true, sourceText: pub[0] });

  // Preferences: never read from inside a hard rule's own words.
  let rest = sentence;
  for (const r of hardRules) rest = rest.replace(r.sourceText, " ");
  const preferences: Preference[] = [];
  for (const p of PREFS) {
    const m = rest.match(p.re);
    if (!m) continue;
    const idx = m.index ?? 0;
    const near = rest.slice(idx, idx + m[0].length + 18).toLowerCase();
    const weight = /if possible|maybe|ideally/.test(near) ? 1 : 2;
    preferences.push({ id: `pf-${ownerId}-${p.tag}`, tag: p.tag, weight, sourceText: m[0] });
  }
  return { hardRules, preferences };
}

/* --------------------------- shareable lines --------------------------- */

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export interface ProposedLines {
  facts: Fact[];
  lines: ShareableLine[];
}

/** Lines the owner can approve: one per preference (from the catalogue)
 *  and one per approved profile fact ("About me: ..."). */
export function proposeLines(ownerId: string, preferences: Preference[], profileFacts: Fact[]): ProposedLines {
  const facts: Fact[] = [];
  const lines: ShareableLine[] = [];
  for (const pref of preferences) {
    const spec = PREFS.find((p) => p.tag === pref.tag);
    if (!spec) continue;
    const fact: Fact = { id: `bf-${ownerId}-${spec.tag}`, ownerId, tag: spec.tag, text: spec.line, ask: spec.ask, approved: false, source: "brief" };
    facts.push(fact);
    lines.push({ id: `sl-${ownerId}-${spec.tag}`, ownerId, text: spec.line, factIds: [fact.id], approved: false });
  }
  for (const f of profileFacts.filter((x) => x.approved && x.source !== "brief")) {
    lines.push({ id: `sl-${f.id}`, ownerId, text: `About me: ${lowerFirst(f.text)}.`, factIds: [f.id], approved: false });
  }
  return { facts, lines };
}

/* ------------------------------ the model ------------------------------ */

const ModelBrief = z.object({
  hardRules: z
    .array(
      z.object({
        kind: z.enum(["end_by", "max_price", "no_drink_minimum", "public_venue"]),
        value: z.union([Clock, z.number(), z.literal(true)]),
        sourceText: z.string(),
      }),
    )
    .max(6),
  preferenceTags: z.array(z.enum(PREFS.map((p) => p.tag) as [string, ...string[]])).max(6),
});
type ModelBrief = z.infer<typeof ModelBrief>;

const SYSTEM = `You turn one sentence about a night out into JSON.
Return {"hardRules":[...],"preferenceTags":[...]}.
hardRules are things the person will not do. Kinds:
- "end_by": value is a 24h "HH:MM" clock the night must end by (evening times are PM; midnight is "00:00").
- "max_price": value is the most they will pay in US dollars, a number.
- "no_drink_minimum": value true when they don't want to be somewhere they must buy or drink alcohol.
- "public_venue": value true when they want a public place.
sourceText is the exact words from the sentence.
preferenceTags are chosen only from: ${PREFS.map((p) => p.tag).join(", ")}.
Return only JSON.`;

function toParsed(ownerId: string, m: ModelBrief, sentence: string): ParsedBrief {
  const hardRules: HardRule[] = [];
  for (const r of m.hardRules) {
    const id = `hr-${ownerId}-${r.kind === "end_by" ? "end" : r.kind === "max_price" ? "price" : r.kind === "no_drink_minimum" ? "drink" : "public"}`;
    const parsed = HardRule.safeParse({ id, kind: r.kind, value: r.value, sourceText: r.sourceText });
    if (parsed.success && !hardRules.some((h) => h.kind === r.kind)) hardRules.push(parsed.data);
  }
  const preferences = m.preferenceTags.map((tag) => ({ id: `pf-${ownerId}-${tag}`, tag, weight: 2, sourceText: tag }));
  return mergeStricter(parseSentence(ownerId, sentence), { hardRules, preferences });
}

/** Code is the judge: keep every rule either reader found, at its strictest. */
export function mergeStricter(a: ParsedBrief, b: ParsedBrief): ParsedBrief {
  const rules = new Map<string, HardRule>();
  for (const r of [...a.hardRules, ...b.hardRules]) {
    const prev = rules.get(r.kind);
    if (!prev) rules.set(r.kind, r);
    else if (r.kind === "max_price" && prev.kind === "max_price") rules.set(r.kind, r.value < prev.value ? r : prev);
    else if (r.kind === "end_by" && prev.kind === "end_by") {
      const ev = (c: string) => {
        const [h, m] = c.split(":").map(Number) as [number, number];
        return (h < 6 ? h + 24 : h) * 60 + m;
      };
      rules.set(r.kind, ev(r.value) < ev(prev.value) ? r : prev);
    }
  }
  const prefs = new Map<string, Preference>();
  for (const p of [...a.preferences, ...b.preferences]) if (!prefs.has(p.tag)) prefs.set(p.tag, p);
  return { hardRules: [...rules.values()], preferences: [...prefs.values()] };
}

export interface BuiltBrief {
  brief: Brief;
  facts: Fact[];
  source: ModelSource;
}

/** Build a brief. `approvedLineIds` are the lines the owner ticked. */
export async function buildBrief(
  ownerId: string,
  sentence: string,
  profileFacts: Fact[],
  approvedLineIds?: string[],
): Promise<BuiltBrief> {
  const local = () => parseSentence(ownerId, sentence);
  const res = await callModel<ModelBrief>({
    role: "ember",
    task: "brief",
    system: SYSTEM,
    user: sentence,
    schema: ModelBrief,
    mock: () => toModelShape(local()),
    fallback: () => toModelShape(local()),
  });
  const parsed = res.source === "model" ? toParsed(ownerId, res.value, sentence) : local();
  const proposed = proposeLines(ownerId, parsed.preferences, profileFacts);
  const approve = (id: string) => (approvedLineIds ? approvedLineIds.includes(id) : true);
  const lines = proposed.lines.map((l) => ({ ...l, approved: approve(l.id) }));
  const facts = proposed.facts.map((f) => ({ ...f, approved: lines.some((l) => l.approved && l.factIds.includes(f.id)) }));
  const brief = Brief.parse({
    id: `brief-${ownerId}`,
    ownerId,
    sentence,
    hardRules: parsed.hardRules,
    preferences: parsed.preferences,
    shareable: lines,
    source: res.source === "model" ? "model" : res.source === "mock" ? "fixture" : "fallback",
  });
  return { brief, facts, source: res.source };
}

function toModelShape(p: ParsedBrief): ModelBrief {
  return {
    hardRules: p.hardRules.map((r) => ({ kind: r.kind, value: r.value, sourceText: r.sourceText })),
    preferenceTags: p.preferences.map((x) => x.tag),
  };
}
