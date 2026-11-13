# Companion Engine for Queue Up: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In the Queue Up app (`origin/adi-initial`), replace the Party Formation Agent and the after-the-fact companion pre-chats with the Companion engine: briefs, Orchestrator circles, batched Companion rounds, deep dives, deliberation, Orchestrator-formed parties, and a group conversation with sign-off.

**Architecture:** A new pure module `lib/companion/` holds the engine (briefs, checks, orchestrator, rounds, room). `lib/server/rooms.ts` persists a run and turns its parties into the `Candidate` objects the existing pipeline already commits. The queue tick calls the room matcher where it used to call `chooseCandidate`. Every Muse call goes through the existing `runAi` with a zod schema and a deterministic fallback, so tests (mock mode) and the offline demo (cache mode) run with no network.

**Tech Stack:** Next.js 15 App Router, TypeScript, Prisma + SQLite, zod, Vitest, Playwright, pnpm. Model: Muse via `lib/ai` (`runAi`).

**Spec:** `docs/superpowers/specs/2026-11-12-companion-engine-design.md` (see "Target codebase: Queue Up"). Copy the spec and this plan into the new branch under the same paths.

## Global Constraints

- Work on a new branch `companion-engine` cut from `origin/adi-initial`, in its own git worktree. Do not touch the `ekansh` working tree. Do not commit or push unless the user asks.
- Every model call uses `runAi({ task, system, user, schema, fallback, maxTokens, temperature, timeoutMs })`. No direct `fetch` to a model. No provider other than what `lib/ai` already configures.
- Batched Companion and Orchestrator calls pass `timeoutMs: 60_000`, `temperature: 0.4`, and `maxTokens` sized to the batch (`400 * partners + 400`, max 6000).
- **Prompts must be deterministic** for a given room: sort ids, no timestamps, no random values, stable key order. The cache key is a hash of the prompt.
- Party size is the queue's `targetSize` (2-8), exactly. Circle size 8-15; a room of 15 or fewer is one circle with no Orchestrator circle call. Room cap 30.
- Up to 4 picks and 5 deep partners per Companion; a score gap of 25 or more also triggers a deep dive. Pair score = the lower of the two verdict scores.
- One deliberation round. One Orchestrator revision per circle after a veto.
- Hard safety stays in code: `pairAllowed` and `validateParty` from `lib/match/safety`. Companions never talk across a pair that `pairAllowed` rejects.
- Sensitive items (`SourcedItem.sensitive`, `isSensitiveTag`) never enter a brief or a prompt. Every Companion message is rejected if `isSensitiveText` matches.
- Muse is used only for circles containing at least one person with `isSimulated === false`. Other circles call the fallbacks directly and report source `"template"`.
- The key env var is `MODEL_API_KEY`. Never print or log it.
- `pnpm test` (typecheck, lint, Vitest) and `pnpm test:e2e` must pass at the end.

## Review Focus

1. **A batched reply covers only some partners** (Muse answers 9 of 14). Expected: the missing ones are filled from the fallback; the round completes. Test in Task 4.
2. **Ids come back as first names, unknown ids, or the speaker's own id.** Expected: names map to ids, the rest are dropped. Test in Task 4.
3. **The Companions pick a group with no usable event or no shared free time**, so `formParty` cancels it. Expected: that member set is not retried until the room changes, so the tick does not loop and spend calls. Test in Task 6.
4. **Someone leaves the queue while their room is running.** Expected: the party that included them is not created, nobody is left in status `matched`, and the others stay waiting. Test in Task 6.
5. **Nobody converges: every proposal is invalid or every party is vetoed.** Expected: no party, everyone still waiting, no name given as a reason anywhere a user can read. Test in Task 5.

---

### Task 1: Briefs

**Files:**
- Create: `lib/companion/brief.ts`, `lib/server/briefs.ts`
- Modify: `prisma/schema.prisma` (new model + migration `companion_engine`)
- Test: `tests/unit/companion-brief.test.ts`

**Interfaces:**
- Produces (`lib/companion/brief.ts`, pure):
  - `type Share = "open" | "need_only" | "private"`
  - `interface Fact { id: string; kind: "interest" | "group" | "music" | "event" | "avoid" | "style"; text: string; share: Share; depth?: string }`
  - `interface Brief { ownerId: string; name: string; facts: Fact[]; tonight: { hopingFor: string; energy: SocialStyle }; communication: string; lightsUp: string[]; source: AiSource | "template" }`
  - `interface QueueContext { mode: QueueMode; eventTitle: string | null; targetSize: number }`
  - `sourceFacts(p: Person, shares?: Record<string, Share>): Fact[]`: one fact per non-sensitive item in `likes` (interest), `groups` (group), `music` (music), `eventHistory` (event), `dislikes` (avoid), plus one `style` fact. `id` is the existing source ref, `${p.id}:${fieldName}[${i}]` using the same field names as `lib/cards/claims.ts` (`likes`, `groups`, `music`, `events`, `x_not_interested`), and `${p.id}:socialStyle`. Default share: `need_only` for `avoid`, `open` otherwise; `shares` overrides by id.
  - `openView(b: Brief): { id: string; name: string; facts: Fact[]; tonight: Brief["tonight"]; communication: string }` (open facts only; `name` is the first name).
  - `privateTexts(b: Brief): string[]` (texts of `private` facts).
  - `templateBrief(p: Person, ctx: QueueContext, shares?): Brief` (deterministic; `hopingFor` is built from `ctx`, e.g. "A squad of 5 for Indie Night").
  - `buildBrief(p: Person, ctx: QueueContext, opts: { useModel: boolean; shares?: Record<string, Share> }): Promise<Brief>`: task `companion_brief`. The model may only return `{ depth: Record<factId, string>, communication: string, lightsUp: factId[] }`; unknown ids are ignored; text matching `isSensitiveText` falls back to the template.
- Produces (`lib/server/briefs.ts`):
  - Prisma model `CompanionBrief { userId String @id; user User @relation(...onDelete: Cascade); shares Json; generated Json?; updatedAt DateTime @updatedAt }` (`generated` stores the model's `depth`, `communication`, `lightsUp`).
  - `getBriefFor(userId: string, ctx: QueueContext, useModel: boolean): Promise<Brief>` (reuses `generated` if present, else builds and stores it).
  - `ensureBriefs(people: Person[], ctx: QueueContext, useModel: boolean): Promise<Map<string, Brief>>`.
  - `setShare(userId: string, factId: string, share: Share): Promise<{ ok: boolean; error?: "unknown_fact" | "bad_share" }>`.

- [ ] **Step 1: Write the failing tests**

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { mockProvider } from "@/lib/ai";
import { buildBrief, openView, privateTexts, sourceFacts, templateBrief } from "@/lib/companion/brief";
import { resolveSource } from "@/lib/cards/claims";
import { loadPeopleFromFiles } from "../helpers/people";

const people = loadPeopleFromFiles();
const me = people.get("p01")!;
const ctx = { mode: "events" as const, eventTitle: "Indie Night", targetSize: 5 };
const subjects = new Map([...people.values()].map((p) => [p.id, { id: p.id, name: p.name, profile: p.profile, friends: p.friends }]));

describe("companion brief", () => {
  beforeEach(() => mockProvider().reset());

  it("every fact id is a resolvable source ref and no fact is sensitive", () => {
    for (const p of people.values()) {
      for (const f of sourceFacts(p)) {
        const r = resolveSource(f.id, subjects);
        expect(r.ok, f.id).toBe(true);
        expect(r.item?.sensitive ?? false).toBe(false);
      }
    }
  });

  it("dislikes default to need_only and overrides apply", () => {
    const facts = sourceFacts(me);
    expect(facts.filter((f) => f.kind === "avoid").every((f) => f.share === "need_only")).toBe(true);
    const first = facts[0].id;
    expect(sourceFacts(me, { [first]: "private" })[0].share).toBe("private");
  });

  it("openView and privateTexts split by share", () => {
    const b = templateBrief(me, ctx, { [sourceFacts(me)[0].id]: "private" });
    expect(openView(b).facts.every((f) => f.share === "open")).toBe(true);
    expect(privateTexts(b)).toEqual([sourceFacts(me)[0].text]);
    expect(b.tonight.hopingFor).toContain("Indie Night");
  });

  it("the model can add depth but not facts", async () => {
    const id = sourceFacts(me)[0].id;
    mockProvider().on("companion_brief", () => JSON.stringify({ depth: { [id]: "goes most weekends", "p01:likes[999]": "invented" }, communication: "Asks a lot of questions and warms up fast.", lightsUp: [id, "nope"] }));
    const b = await buildBrief(me, ctx, { useModel: true });
    expect(b.source).toBe("mock");
    expect(b.facts.map((f) => f.id)).toEqual(sourceFacts(me).map((f) => f.id));
    expect(b.facts[0].depth).toBe("goes most weekends");
    expect(b.lightsUp).toEqual([id]);
  });

  it("sensitive model text falls back to the template; useModel false makes no call", async () => {
    mockProvider().on("companion_brief", () => JSON.stringify({ depth: {}, communication: "Talks about church a lot.", lightsUp: [] }));
    expect((await buildBrief(me, ctx, { useModel: true })).communication).not.toMatch(/church/i);
    mockProvider().reset();
    expect((await buildBrief(me, ctx, { useModel: false })).source).toBe("template");
    expect(mockProvider().calls).toHaveLength(0);
  });
});
```

Add a DB test in the same file: after `seedDatabase`, `setShare("p01", <id>, "private")` returns `{ ok: true }`, an unknown id returns `unknown_fact`, `"loud"` returns `bad_share`, and `getBriefFor("p01", ctx, false)` reflects the stored share. A second `getBriefFor(..., true)` with a mock handler makes one model call, a third makes none.

- [ ] **Step 2: Run** `pnpm exec vitest run tests/unit/companion-brief.test.ts`. Expected: fails on the missing module.
- [ ] **Step 3: Add the Prisma model**, run `pnpm exec prisma migrate dev --name companion_engine`, and add `prisma.companionBrief.deleteMany()` to `tests/helpers/db.ts` `resetDb` (before `user.deleteMany`).
- [ ] **Step 4: Implement `brief.ts` and `briefs.ts`.** The system prompt tells the Profile Analyst to describe how the person communicates **in the third person**, to add one line of depth to facts it has evidence for, and never to mention politics, religion, health or sexuality.
- [ ] **Step 5: Run** the test file. Expected: PASS.

---

### Task 2: Message checks

**Files:**
- Create: `lib/companion/checks.ts`
- Test: `tests/unit/companion-checks.test.ts`

**Interfaces:**
- Consumes: `Brief`, `privateTexts`, `isSensitiveText`.
- Produces:
  - `interface Msg { say: string; cites: string[]; blocked: boolean; reason?: string }`
  - `NEUTRAL = "Happy to hear more about your person."`
  - `checkMessage(b: Brief, say: string, cites: string[]): { ok: true } | { ok: false; reason: "bad citation" | "private text" | "sensitive" }`: a citation is valid only if it is the id of one of `b`'s `open` facts.
  - `safeMessage(b: Brief, raw: { say?: string; cites?: string[] } | undefined): Msg`: returns the checked message, or `{ say: NEUTRAL, cites: [], blocked: true, reason }`. Missing or empty `say` is `blocked` with reason `"empty"`.
  - `auditPrompt(prompt: string, othersPrivate: string[]): string[]`.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { templateBrief, sourceFacts } from "@/lib/companion/brief";
import { auditPrompt, checkMessage, NEUTRAL, safeMessage } from "@/lib/companion/checks";
import { loadPeopleFromFiles } from "../helpers/people";

const people = loadPeopleFromFiles();
const ctx = { mode: "events" as const, eventTitle: null, targetSize: 4 };
const facts = sourceFacts(people.get("p01")!);
const hidden = facts[0];
const open = facts[1];
const b = templateBrief(people.get("p01")!, ctx, { [hidden.id]: "private" });

describe("companion message checks", () => {
  it("accepts a cited open fact", () => expect(checkMessage(b, "They love this.", [open.id])).toEqual({ ok: true }));
  it("rejects private, need_only and foreign citations", () => {
    const avoid = facts.find((f) => f.kind === "avoid");
    expect(checkMessage(b, "x", [hidden.id])).toMatchObject({ reason: "bad citation" });
    if (avoid) expect(checkMessage(b, "x", [avoid.id])).toMatchObject({ reason: "bad citation" });
    expect(checkMessage(b, "x", ["p02:likes[0]"])).toMatchObject({ reason: "bad citation" });
  });
  it("catches private text regardless of case and spacing", () => {
    expect(checkMessage(b, `Into ${hidden.text.toUpperCase().replace(/ /g, "  ")}`, [])).toMatchObject({ reason: "private text" });
  });
  it("catches sensitive text", () => expect(checkMessage(b, "They go to church weekly.", [])).toMatchObject({ reason: "sensitive" }));
  it("safeMessage swaps in the neutral line", () => {
    expect(safeMessage(b, { say: hidden.text, cites: [] })).toMatchObject({ say: NEUTRAL, cites: [], blocked: true });
    expect(safeMessage(b, undefined)).toMatchObject({ blocked: true, reason: "empty" });
    expect(safeMessage(b, { say: "Hello.", cites: [] }).blocked).toBe(false);
  });
  it("auditPrompt finds other people's private text", () => {
    expect(auditPrompt(`...${hidden.text}...`, [hidden.text, "zzz"])).toEqual([hidden.text]);
  });
});
```

- [ ] **Step 2: Run** the file. Expected: fails on the missing module.
- [ ] **Step 3: Implement `checks.ts`.** Normalise with lowercase and collapsed whitespace before substring tests.
- [ ] **Step 4: Run** the file. Expected: PASS.

---

### Task 3: Orchestrator

**Files:**
- Create: `lib/companion/orchestrator.ts`
- Test: `tests/unit/companion-orchestrator.test.ts`

**Interfaces:**
- Consumes: `Brief`, `openView`, `pairAllowed`, `validateParty`, `runAi`.
- Produces:
  - `MIN_CIRCLE = 8`, `MAX_CIRCLE = 15`, `MAX_ROOM = 30`, `MAX_PICKS = 4`, `MAX_DEEP = 5`, `GAP = 25`.
  - `interface Verdict { score: number; wouldEnjoy: string[]; concerns: string[]; needs: string[]; talkTopics: string[]; opener: string; confidence: "low" | "medium" | "high" }`
  - `type Verdicts = Map<string, Map<string, Verdict>>` (from, about).
  - `interface Circle { id: string; theme: string; members: string[] }`
  - `interface TableRow { id: string; by: string; members: string[]; line: string; backers: string[] }`
  - `interface ProposedParty { members: string[]; why: string }`
  - `pairScore(v: Verdicts, a: string, b: string): number` (lower of the two; 0 if either is missing).
  - `fixCircles(raw: { theme?: string; members?: string[] }[], ids: string[], people: Map<string, Person>, minSize: number): { circles: Circle[]; unplaced: string[] }`: drops unknown and repeated ids, splits circles over `MAX_CIRCLE`, moves members of circles under `minSize` to `unplaced`, lists never-placed ids as `unplaced`. Circle ids are `c1`, `c2`, ... in order.
  - `drawCircles(briefs: Map<string, Brief>, people: Map<string, Person>, targetSize: number, useModel: boolean): Promise<{ circles: Circle[]; unplaced: string[]; source: string }>`: task `orchestrator_circles`. No call when `briefs.size <= MAX_CIRCLE`: one circle `c1` with theme "Everyone in your queue". `minSize` passed to `fixCircles` is `Math.max(targetSize, MIN_CIRCLE)` capped at the room size. Fallback: order by top interest tag, then id, and chunk evenly.
  - `deepPairs(picks: Map<string, string[]>, v: Verdicts, members: string[], people: Map<string, Person>): [string, string][]`: sorted pairs where either picked the other or the two scores differ by `GAP` or more; never a pair `pairAllowed` rejects; each person in at most `MAX_DEEP` pairs, highest `pairScore` kept.
  - `wanted(table: TableRow[], responses: Map<string, { action: "back" | "amend" | "hold"; proposalId?: string; members?: string[] }>): Map<string, Set<string>>`.
  - `validateParties(proposed: ProposedParty[], circle: string[], want: Map<string, Set<string>>, people: Map<string, Person>, targetSize: number, exclude: string[][]): ProposedParty[]`: keeps a party only if it has exactly `targetSize` distinct members of the circle, none already used, `validateParty(members).ok`, every member is in the `want` set of another member, and its member set is not in `exclude`.
  - `formParties(input: { circle: Circle; table: TableRow[]; want: Map<string, Set<string>>; verdicts: Verdicts; briefs: Map<string, Brief>; people: Map<string, Person>; targetSize: number; exclude: string[][]; attempt: number; useModel: boolean }): Promise<{ parties: ProposedParty[]; heldBack: string[]; source: string }>`: task `orchestrator_form`. Model output passes through `validateParties`. Fallback: rows in order of backer count, then mean pair score, greedily.

- [ ] **Step 1: Write the failing tests**

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { mockProvider } from "@/lib/ai";
import { templateBrief } from "@/lib/companion/brief";
import * as orc from "@/lib/companion/orchestrator";
import { loadPeopleFromFiles } from "../helpers/people";

const people = loadPeopleFromFiles();
const ctx = { mode: "events" as const, eventTitle: null, targetSize: 4 };
// 30 adults who are all mutually allowed (same age band, no blocks, no women-only)
const adults = [...people.values()].filter((p) => p.ageBand === "18-24" && !p.womenOnlyParty && p.blocked.size === 0).map((p) => p.id).sort().slice(0, 30);
const briefs = (ids: string[]) => new Map(ids.map((i) => [i, templateBrief(people.get(i)!, ctx)]));
const v = (score: number) => ({ score, wouldEnjoy: [], concerns: [], needs: [], talkTopics: [], opener: "", confidence: "medium" as const });
const verdicts = (ids: string[], score = 50) => new Map(ids.map((a) => [a, new Map(ids.filter((b) => b !== a).map((b) => [b, v(score)]))]));

describe("orchestrator", () => {
  beforeEach(() => mockProvider().reset());

  it("has enough mutually-allowed adults for these tests", () => expect(adults).toHaveLength(30));

  it("pairScore is the lower score, 0 when missing", () => {
    const [a, b] = adults;
    const vs = verdicts([a, b]);
    vs.get(a)!.set(b, v(90));
    vs.get(b)!.set(a, v(60));
    expect(orc.pairScore(vs, a, b)).toBe(60);
    expect(orc.pairScore(new Map(), a, b)).toBe(0);
  });

  it("a room of 15 or fewer is one circle with no model call", async () => {
    const out = await orc.drawCircles(briefs(adults.slice(0, 12)), people, 4, true);
    expect(out.circles).toHaveLength(1);
    expect(out.circles[0].members).toEqual(adults.slice(0, 12));
    expect(mockProvider().calls).toHaveLength(0);
  });

  it("30 people fall back to valid circles covering everyone once", async () => {
    const out = await orc.drawCircles(briefs(adults), people, 4, true);
    const placed = out.circles.flatMap((c) => c.members);
    expect([...placed, ...out.unplaced].sort()).toEqual(adults);
    expect(new Set(placed).size).toBe(placed.length);
    expect(out.circles.every((c) => c.members.length >= orc.MIN_CIRCLE && c.members.length <= orc.MAX_CIRCLE)).toBe(true);
  });

  it("fixCircles repairs bad model output", () => {
    const raw = [{ theme: "a", members: [...adults.slice(0, 10), "ghost", adults[0]] }, { theme: "b", members: adults.slice(10, 13) }];
    const out = orc.fixCircles(raw, adults, people, orc.MIN_CIRCLE);
    expect(out.circles).toHaveLength(1);
    expect(out.circles[0].members).toEqual(adults.slice(0, 10));
    expect(out.unplaced.sort()).toEqual(adults.slice(10));
  });

  it("deepPairs: one-sided picks, score gaps, the cap, and never a disallowed pair", () => {
    const m = adults.slice(0, 8);
    const vs = verdicts(m);
    vs.get(m[0])!.set(m[1], v(90));
    vs.get(m[1])!.set(m[0], v(40));
    const picks = new Map([[m[2], [m[3]]], [m[7], m.slice(0, 7)]]);
    const pairs = orc.deepPairs(picks, vs, m, people).map((p) => p.join("|"));
    expect(pairs).toContain([m[0], m[1]].join("|"));
    expect(pairs).toContain([m[2], m[3]].join("|"));
    expect(pairs.filter((p) => p.includes(m[7])).length).toBe(orc.MAX_DEEP);
    const blockedPair = ["p01", "p09"]; // seeded block
    expect(orc.deepPairs(new Map([["p01", ["p09"]]]), verdicts(blockedPair), blockedPair, people)).toEqual([]);
  });

  it("wanted collects proposed, amended and backed groups", () => {
    const [a, b, c, d] = adults;
    const table = [{ id: "prop-" + a, by: a, members: [a, b, c], line: "", backers: [b] }];
    const responses = new Map([[b, { action: "back" as const, proposalId: "prop-" + a }], [d, { action: "amend" as const, proposalId: "prop-" + a, members: [a, b, d] }]]);
    const w = orc.wanted(table, responses);
    expect([...w.get(a)!].sort()).toEqual([b, c].sort());
    expect([...w.get(b)!].sort()).toEqual([a, c].sort());
    expect([...w.get(d)!].sort()).toEqual([a, b].sort());
  });

  it("validateParties enforces size, reuse, wanted, exclude and safety", () => {
    const [a, b, c, d, e] = adults;
    const want = new Map([[a, new Set([b, c])], [b, new Set([a])], [c, new Set([a])]]);
    const ok = { members: [a, b, c], why: "x" };
    const run = (ps: orc.ProposedParty[], size = 3, exclude: string[][] = []) => orc.validateParties(ps, [a, b, c, d, e], want, people, size, exclude);
    expect(run([ok])).toEqual([ok]);
    expect(run([ok], 4)).toEqual([]);                                   // wrong size
    expect(run([{ members: [a, b, d], why: "" }])).toEqual([]);         // d wanted by nobody
    expect(run([ok, { members: [a, b, c], why: "" }])).toEqual([ok]);   // reuse
    expect(run([ok], 3, [[c, b, a]])).toEqual([]);                      // vetoed set
    const unsafe = { members: ["p01", "p09", a], why: "" };
    const w2 = new Map([["p01", new Set(["p09", a])], ["p09", new Set(["p01"])], [a, new Set(["p01"])]]);
    expect(orc.validateParties([unsafe], ["p01", "p09", a], w2, people, 3, [])).toEqual([]);
  });

  it("formParties falls back to the most-backed valid proposal and re-validates the model", async () => {
    const m = adults.slice(0, 5);
    const circle = { id: "c1", theme: "", members: m };
    const table = [{ id: "prop-" + m[0], by: m[0], members: m.slice(0, 3), line: "", backers: [m[1], m[2]] }];
    const want = new Map([[m[0], new Set([m[1], m[2]])], [m[1], new Set([m[0], m[2]])], [m[2], new Set([m[0], m[1]])]]);
    const input = { circle, table, want, verdicts: verdicts(m), briefs: briefs(m), people, targetSize: 3, exclude: [], attempt: 1, useModel: true };
    const fb = await orc.formParties(input);
    expect(fb.source).toBe("fallback");
    expect(fb.parties[0].members).toEqual(m.slice(0, 3));
    expect(fb.heldBack.sort()).toEqual(m.slice(3));
    mockProvider().on("orchestrator_form", () => JSON.stringify({ parties: [{ members: [m[0], m[3], m[4]], why: "I decided" }] }));
    expect((await orc.formParties(input)).parties.map((p) => p.members)).toEqual([m.slice(0, 3)]); // m[3], m[4] were wanted by nobody
  });
});
```

- [ ] **Step 2: Run** the file. Expected: fails on the missing module. If the "30 mutually-allowed adults" guard fails, widen the filter (it only needs 30 people for whom every pair passes `pairAllowed`) before going on.
- [ ] **Step 3: Implement the pure functions.**
- [ ] **Step 4: Implement `drawCircles` and `formParties`.** Prompts give first names with ids and ask for ids back; map first names to ids. The `orchestrator_form` system prompt states that only people a member's Companion wanted may be grouped, that parties are exactly `targetSize`, and that `why` is one or two friendly sentences to the group that never name anyone outside it. When the model's validated output is empty, use the fallback.
- [ ] **Step 5: Run** the file. Expected: PASS.

---

### Task 4: Companion rounds

**Files:**
- Create: `lib/companion/rounds.ts`
- Test: `tests/unit/companion-rounds.test.ts`

**Interfaces:**
- Consumes: `Brief`, `openView`, `safeMessage`, `auditPrompt`, `Msg`, `Verdict`, `TableRow`, `runAi`, `makePairScorer`.
- Produces. Every function takes a first argument `c: RoundCtx = { brief: Brief; me: Person; people: Map<string, Person>; othersPrivate: string[]; useModel: boolean }` and returns `source: string` and `audit: string[]`. Every outgoing message passes through `safeMessage`. A partner missing from the model's reply is filled from the fallback. If `audit` is non-empty, no call is made and the result is the fallback.

| Function | Extra arguments | Returns | Task |
|---|---|---|---|
| `askRound` | `intros: Map<string, OpenView>` | `asks: Map<string, Msg>` | `companion_ask` |
| `answerRound` | `intros`, `questions: Map<string, string>` | `answers: Map<string, Msg>`, `verdicts: Map<string, Verdict>`, `picks: string[]` | `companion_answer` |
| `followUpRound` | `threads: Map<string, ThreadMsg[]>` | `says: Map<string, Msg>` | `companion_followup` |
| `closeRound` | `threads`, `members: string[]`, `verdicts: Map<string, Verdict>`, `targetSize: number` | `says`, `verdicts` (updated, deep partners only), `proposal: { members: string[]; privateReason: string; line: Msg }` | `companion_close` |
| `deliberate` | `table: TableRow[]`, `verdicts`, `targetSize` | `action`, `proposalId?`, `members?`, `line: Msg` | `companion_deliberate` |
| `groupSpeak` | `members: string[]`, `intros`, `verdicts` | `line: Msg` | `companion_group1` |
| `groupRespond` | `members`, `lines: { from: string; say: string }[]`, `verdicts` | `line: Msg`, `decision: "yes" | "yes_if" | "no"`, `need: string`, `privateReason: string` | `companion_group2` |

  - `interface ThreadMsg { from: string; to: string; kind: "intro" | "ask" | "answer" | "followup" | "close"; say: string; cites: string[]; blocked: boolean }`
  - `type OpenView = ReturnType<typeof openView>`
  - `fallbackVerdict(a: Person, b: Person): Verdict`: `score = Math.round(makePairScorer()(a, b).score * 100)`; `talkTopics` = ids of the two people's shared open interest facts; `opener` from the first shared tag.
  - A proposal always contains its owner and exactly `targetSize` distinct circle members the owner is `pairAllowed` with; otherwise it is rebuilt from the fallback (owner plus its highest-scored allowed people).
  - `picks` has at most `MAX_PICKS` entries, never the owner. Scores are clamped to 0-100.
  - With no deep partners, `followUpRound` and `closeRound` return empty `says`, and `closeRound` still returns a proposal.
  - Prompt rule: the `user` JSON for every round is `{ you_represent, your_brief, round, ...public payload }` where `your_brief` is the Companion's full brief and everything else is built only from `OpenView`s, public thread text and table rows.

- [ ] **Step 1: Write the failing tests**

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { mockProvider } from "@/lib/ai";
import { openView, privateTexts, sourceFacts, templateBrief } from "@/lib/companion/brief";
import * as rounds from "@/lib/companion/rounds";
import { loadPeopleFromFiles } from "../helpers/people";

const people = loadPeopleFromFiles();
const qctx = { mode: "events" as const, eventTitle: "Indie Night", targetSize: 4 };
const circle = [...people.values()].filter((p) => p.ageBand === "18-24" && !p.womenOnlyParty && p.blocked.size === 0).map((p) => p.id).sort().slice(0, 6);
const me = circle[0];
const others = circle.slice(1);
const briefs = new Map(circle.map((i) => [i, templateBrief(people.get(i)!, qctx)]));
const intros = new Map(others.map((i) => [i, openView(briefs.get(i)!)]));
const ctx = (over: Partial<rounds.RoundCtx> = {}): rounds.RoundCtx => ({ brief: briefs.get(me)!, me: people.get(me)!, people, othersPrivate: [], useModel: true, ...over });
const firstName = (id: string) => people.get(id)!.name.split(" ")[0];

describe("companion rounds", () => {
  beforeEach(() => mockProvider().reset());

  it("askRound falls back to one question per circle-mate", async () => {
    const out = await rounds.askRound(ctx(), intros);
    expect([...out.asks.keys()].sort()).toEqual(others);
    expect([...out.asks.values()].every((m) => m.say.trim().endsWith("?"))).toBe(true);
    expect(out.source).toBe("fallback");
  });

  it("a partial reply is topped up; first names map to ids; self and unknown ids are dropped", async () => {
    mockProvider().on("companion_ask", () => JSON.stringify({ asks: { [firstName(others[0])]: { say: "What do they do at 11pm?", cites: [] }, [me]: { say: "self?", cites: [] }, ghost: { say: "x?", cites: [] } } }));
    const out = await rounds.askRound(ctx(), intros);
    expect([...out.asks.keys()].sort()).toEqual(others);
    expect(out.asks.get(others[0])!.say).toBe("What do they do at 11pm?");
  });

  it("the prompt holds this Companion's brief and only open views of the others", async () => {
    mockProvider().on("companion_ask", () => JSON.stringify({ asks: {} }));
    const hidden = sourceFacts(people.get(others[0])!)[0];
    const b2 = new Map(briefs).set(others[0], templateBrief(people.get(others[0])!, qctx, { [hidden.id]: "private" }));
    const i2 = new Map(others.map((i) => [i, openView(b2.get(i)!)]));
    await rounds.askRound(ctx({ othersPrivate: privateTexts(b2.get(others[0])!) }), i2);
    const prompt = mockProvider().calls[0].messages[1].content;
    expect(prompt).not.toContain(hidden.text);
    expect(JSON.parse(prompt).your_brief.ownerId).toBe(me);
  });

  it("answerRound gives a clamped verdict per person and at most 4 picks", async () => {
    mockProvider().on("companion_answer", () => JSON.stringify({ answers: {}, verdicts: Object.fromEntries(others.map((o) => [o, { score: 400 }])), picks: [me, ...others] }));
    const out = await rounds.answerRound(ctx(), intros, new Map(others.map((o) => [o, "What would they do?"])));
    expect([...out.verdicts.keys()].sort()).toEqual(others);
    expect([...out.verdicts.values()].every((x) => x.score <= 100 && x.score >= 0)).toBe(true);
    expect(out.picks.length).toBeLessThanOrEqual(4);
    expect(out.picks).not.toContain(me);
    expect([...out.answers.keys()].sort()).toEqual(others);
  });

  it("private text in a reply is blocked", async () => {
    const hidden = sourceFacts(people.get(me)!)[0];
    const mine = templateBrief(people.get(me)!, qctx, { [hidden.id]: "private" });
    mockProvider().on("companion_ask", () => JSON.stringify({ asks: { [others[0]]: { say: `They are into ${hidden.text}. Yours?`, cites: [] } } }));
    const out = await rounds.askRound(ctx({ brief: mine }), intros);
    expect(out.asks.get(others[0])!.blocked).toBe(true);
    expect(out.asks.get(others[0])!.say).not.toContain(hidden.text);
  });

  it("an audit failure skips the call", async () => {
    const leaked = "zz-private-phrase";
    const bad = new Map(intros).set(others[0], { ...intros.get(others[0])!, communication: leaked });
    const out = await rounds.askRound(ctx({ othersPrivate: [leaked] }), bad);
    expect(out.audit).toEqual([leaked]);
    expect(mockProvider().calls).toHaveLength(0);
  });

  it("closeRound repairs a bad proposal to exactly targetSize including the owner", async () => {
    mockProvider().on("companion_close", () => JSON.stringify({ says: {}, verdicts: {}, proposal: { members: [others[0], "ghost"] } }));
    const vs = new Map(others.map((o) => [o, rounds.fallbackVerdict(people.get(me)!, people.get(o)!)]));
    const out = await rounds.closeRound(ctx(), new Map(), circle, vs, 4);
    expect(out.proposal.members).toHaveLength(4);
    expect(out.proposal.members).toContain(me);
    expect(new Set(out.proposal.members).size).toBe(4);
    expect(out.proposal.members.every((x) => circle.includes(x))).toBe(true);
    expect(out.says.size).toBe(0);
  });

  it("deliberate and groupRespond return valid enums on garbage output; useModel false makes no call", async () => {
    mockProvider().on("companion_deliberate", () => JSON.stringify({ action: "shout" }));
    mockProvider().on("companion_group2", () => "definitely!");
    const table = [{ id: "prop-" + others[0], by: others[0], members: [me, ...others.slice(0, 3)], line: "x", backers: [] }];
    expect(["back", "amend", "hold"]).toContain((await rounds.deliberate(ctx(), table, new Map(), 4)).action);
    expect(["yes", "yes_if", "no"]).toContain((await rounds.groupRespond(ctx(), circle.slice(0, 4), [], new Map())).decision);
    mockProvider().reset();
    expect((await rounds.askRound(ctx({ useModel: false }), intros)).source).toBe("template");
    expect(mockProvider().calls).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run** the file. Expected: fails on the missing module.
- [ ] **Step 3: Implement a shared `round<T>(c, task, payload, instruction, schema, fallback)` helper**: builds the `user` JSON, runs `auditPrompt`, returns the fallback with source `"template"` when `!c.useModel`, otherwise calls `runAi`. zod schemas are lenient (`z.record(z.string(), ...)`, optional fields with defaults) so a partial reply still parses. The system instruction: the Companion represents its person in the third person, never speaks as them, never states private facts, cites its own fact ids, never mentions politics, religion, health or sexuality, and replies with JSON only.
- [ ] **Step 4: Implement the seven round functions and their fallbacks.** Per round: `askRound` asks one scenario question per person; `answerRound` answers in about 100 words each, gives a verdict per person and up to 4 picks; `followUpRound` reacts, names one concern, asks one harder question; `closeRound` answers, states needs, updates verdicts and proposes; `groupSpeak` says how the group would work for its person; `groupRespond` replies and decides. Fallback rules: back the listed proposal that contains the owner and has the highest mean score, otherwise hold; `groupRespond` answers `no` only if a member fails `pairAllowed` with the owner or scores under 30, else `yes`.
- [ ] **Step 5: Run** the file. Expected: PASS.

---

### Task 5: The room

**Files:**
- Create: `lib/companion/room.ts`
- Test: `tests/unit/companion-room.test.ts`

**Interfaces:**
- Consumes: Tasks 1-4, `TraceStep` from `lib/server/trace`, `pairAllowed`.
- Produces:
  - `type Stage = "briefing" | "circles" | "mingling" | "deep" | "deliberating" | "forming" | "group" | "done" | "waiting"`
  - `interface RoomInput { ids: string[]; people: Map<string, Person>; briefs: Map<string, Brief>; targetSize: number; exclude?: string[][]; onStage?: (s: Stage, note: string) => void | Promise<void> }`
  - `interface RoomParty { members: string[]; why: string; circleId: string; groupChat: { from: string; say: string }[]; needs: string[]; steps: TraceStep[] }`
  - `interface RoomResult { circles: Circle[]; unplaced: string[]; threads: Map<string, ThreadMsg[]>; deep: string[]; verdicts: Verdicts; tables: Map<string, TableRow[]>; parties: RoomParty[]; vetoed: string[][]; heldBack: string[]; calls: number }`
  - `pairKey(a: string, b: string): string` (sorted, joined with `|`).
  - `runRoom(input: RoomInput): Promise<RoomResult>`.
  - `sparksFor(a: string, b: string, r: Pick<RoomResult, "verdicts">): string[]`: up to 3 short lines from the two verdicts' `wouldEnjoy`, for `PreChat.sparks`.
  - Each `RoomParty.steps` are trace steps with agents `orchestrator` and `companion`: one `decision` for the circle and theme, one `tool_call` (`toolName: "companionRounds"`) summarising conversations and deep dives, one `reasoning` for the proposals and backing, one `safety_check` for the code re-check, one `decision` for the sign-off. Summaries name only members of that party.

- [ ] **Step 1: Write the failing tests**

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { mockProvider } from "@/lib/ai";
import { privateTexts, sourceFacts, templateBrief } from "@/lib/companion/brief";
import { pairKey, runRoom, type RoomInput } from "@/lib/companion/room";
import { validateParty } from "@/lib/match/safety";
import { loadPeopleFromFiles } from "../helpers/people";

const people = loadPeopleFromFiles();
people.get("p01")!.isSimulated = false; // a real person in the room, so Muse (the mock) is used
const qctx = { mode: "events" as const, eventTitle: "Indie Night", targetSize: 4 };
const pool = ["p01", ...[...people.values()].filter((p) => p.id !== "p01" && p.ageBand === people.get("p01")!.ageBand && !p.womenOnlyParty && p.blocked.size === 0).map((p) => p.id).sort()];
const input = (n: number, over: Partial<RoomInput> = {}): RoomInput => {
  const ids = pool.slice(0, n);
  return { ids, people, briefs: new Map(ids.map((i) => [i, templateBrief(people.get(i)!, qctx)])), targetSize: 4, ...over };
};
const publicText = (r: Awaited<ReturnType<typeof runRoom>>) =>
  JSON.stringify([...r.threads.values()]) + JSON.stringify([...r.tables.values()]) + JSON.stringify(r.parties.map((p) => [p.why, p.groupChat, p.steps]));

describe("companion room", () => {
  beforeEach(() => mockProvider().reset());

  it("forms valid parties of exactly targetSize from a room of 12", async () => {
    const r = await runRoom(input(12));
    expect(r.parties.length).toBeGreaterThan(0);
    const used = r.parties.flatMap((p) => p.members);
    expect(new Set(used).size).toBe(used.length);
    for (const p of r.parties) {
      expect(p.members).toHaveLength(4);
      expect(validateParty(p.members.map((m) => people.get(m)!)).ok).toBe(true);
      expect(p.groupChat.length).toBe(8); // two rounds, four members
      expect(p.steps.at(-1)!.kind).toBe("decision");
    }
  });

  it("every allowed pair in a circle has a 6-message thread; deep pairs have 10", async () => {
    const r = await runRoom(input(10));
    const m = r.circles[0].members;
    for (let i = 0; i < m.length; i++) for (let j = i + 1; j < m.length; j++) {
      expect(r.threads.get(pairKey(m[i], m[j]))!.slice(0, 6).map((x) => x.kind)).toEqual(["intro", "intro", "ask", "ask", "answer", "answer"]);
    }
    expect(r.deep.length).toBeGreaterThan(0);
    for (const k of r.deep) expect(r.threads.get(k)).toHaveLength(10);
  });

  it("30 people: everyone is in one circle or unplaced", async () => {
    const r = await runRoom(input(30));
    const placed = r.circles.flatMap((c) => c.members);
    expect([...placed, ...r.unplaced].sort()).toEqual(pool.slice(0, 30).sort());
    expect(new Set(placed).size).toBe(placed.length);
  });

  it("a disallowed pair never gets a thread and never shares a party", async () => {
    const ids = ["p01", "p09", ...pool.slice(1, 9)]; // p01 has blocked p09
    const r = await runRoom({ ...input(0), ids, briefs: new Map(ids.map((i) => [i, templateBrief(people.get(i)!, qctx)])) });
    expect(r.threads.has(pairKey("p01", "p09"))).toBe(false);
    for (const p of r.parties) expect(p.members.includes("p01") && p.members.includes("p09")).toBe(false);
  });

  it("a veto is binding, triggers one revision, and is anonymous", async () => {
    const vetoer = pool[1];
    const name = people.get(vetoer)!.name.split(" ")[0];
    mockProvider().on("companion_group2", (req) => {
      const u = JSON.parse(req.messages[1].content);
      return JSON.stringify(u.your_brief.ownerId === vetoer
        ? { line: { say: "Thanks all.", cites: [] }, decision: "no", need: "", privateReason: "would not be comfortable here" }
        : { line: { say: "Sounds good.", cites: [] }, decision: "yes", need: "", privateReason: "" });
    });
    const r = await runRoom(input(10));
    expect(r.vetoed.length).toBeGreaterThan(0);
    expect(r.parties.every((p) => !p.members.includes(vetoer))).toBe(true);
    expect(publicText(r)).not.toContain("would not be comfortable");
    for (const p of r.parties) expect(JSON.stringify(p.steps)).not.toContain(name);
    expect(mockProvider().calls.filter((c) => c.task === "orchestrator_form").length).toBeLessThanOrEqual(2 * r.circles.length);
  });

  it("when everyone vetoes, no party forms and nobody is blamed", async () => {
    mockProvider().on("companion_group2", () => JSON.stringify({ line: { say: "Hm.", cites: [] }, decision: "no", need: "", privateReason: "secret reason" }));
    const r = await runRoom(input(8));
    expect(r.parties).toEqual([]);
    expect(r.heldBack.sort()).toEqual(pool.slice(0, 8).sort());
    expect(publicText(r)).not.toContain("secret reason");
  });

  it("a rogue model cannot leak private facts or force a party", async () => {
    const ids = pool.slice(0, 8);
    const briefs = new Map(ids.map((i) => {
      const hidden = sourceFacts(people.get(i)!)[0];
      return [i, templateBrief(people.get(i)!, qctx, { [hidden.id]: "private" })] as const;
    }));
    const leak = (req: { messages: { content: string }[] }) => {
      const u = JSON.parse(req.messages[1].content);
      const secret = privateTexts(briefs.get(u.your_brief.ownerId)!)[0];
      return { say: `My person is into ${secret}.`, cites: [] as string[] };
    };
    const toAll = (req: { messages: { content: string }[] }) => {
      const me = JSON.parse(req.messages[1].content).your_brief.ownerId;
      return Object.fromEntries(ids.filter((i) => i !== me).map((i) => [i, leak(req)]));
    };
    mockProvider()
      .on("companion_ask", (req) => JSON.stringify({ asks: toAll(req) }))
      .on("companion_answer", (req) => JSON.stringify({ answers: toAll(req), picks: ids, verdicts: Object.fromEntries(ids.map((i) => [i, { score: 100 }])) }))
      .on("companion_close", (req) => JSON.stringify({ says: toAll(req), verdicts: {}, proposal: { members: ids, line: leak(req) } }))
      .on("companion_group1", (req) => JSON.stringify({ line: leak(req) }))
      .on("companion_group2", (req) => JSON.stringify({ line: leak(req), decision: "yes" }));
    const r = await runRoom({ ids, people, briefs, targetSize: 4 });
    const text = publicText(r);
    for (const b of briefs.values()) for (const s of privateTexts(b)) expect(text).not.toContain(s);
    for (const p of r.parties) expect(p.members).toHaveLength(4);
  });

  it("garbage from every Companion call still completes on fallbacks", async () => {
    for (const t of ["companion_ask", "companion_answer", "companion_followup", "companion_close", "companion_deliberate", "companion_group1", "companion_group2", "orchestrator_form"]) mockProvider().on(t, () => "not json at all");
    const r = await runRoom(input(8));
    expect(r.parties.length).toBeGreaterThan(0);
  });

  it("a person with everything private still completes and cites nothing", async () => {
    const ids = pool.slice(0, 8);
    const briefs = new Map(ids.map((i) => [i, templateBrief(people.get(i)!, qctx)]));
    const all = Object.fromEntries(sourceFacts(people.get("p01")!).map((f) => [f.id, "private" as const]));
    briefs.set("p01", templateBrief(people.get("p01")!, qctx, all));
    const r = await runRoom({ ids, people, briefs, targetSize: 4 });
    const mine = [...r.threads.values()].flat().filter((m) => m.from === "p01");
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((m) => m.cites.length === 0)).toBe(true);
  });

  it("an all-simulated room makes no model calls; exclude is honoured; prompts are deterministic", async () => {
    const sims = pool.slice(1, 9);
    const base = { ids: sims, people, briefs: new Map(sims.map((i) => [i, templateBrief(people.get(i)!, qctx)])), targetSize: 4 };
    const first = await runRoom(base);
    expect(mockProvider().calls).toHaveLength(0);
    expect(first.calls).toBe(0);
    const again = await runRoom({ ...base, exclude: first.parties.map((p) => p.members) });
    const key = (m: string[]) => [...m].sort().join();
    for (const p of again.parties) expect(first.parties.map((x) => key(x.members))).not.toContain(key(p.members));
    const a = await runRoom(input(8));
    const promptsA = mockProvider().calls.map((c) => c.messages[1].content);
    mockProvider().reset();
    await runRoom(input(8));
    expect(mockProvider().calls.map((c) => c.messages[1].content)).toEqual(promptsA);
    void a;
  });
});
```

- [ ] **Step 2: Run** the file. Expected: fails on the missing module.
- [ ] **Step 3: Implement `runRoom`.** Stages, each calling `onStage`:
  1. `drawCircles`. `useModel` for a circle is true when any member has `isSimulated === false`.
  2. Per circle (circles in parallel, Companions within a round in parallel with `Promise.all`): post intros in code from `openView` (kind `intro`, citing the open fact ids); `askRound`; `answerRound`. Skip any pair `pairAllowed` rejects everywhere.
  3. `deepPairs`; `followUpRound`, then `closeRound` for every member.
  4. Build the table (`id: "prop-" + owner`); `deliberate` for every member; fill `backers`; `wanted`.
  5. `formParties`.
  6. Per proposed party: `groupSpeak` for all, then `groupRespond` for all. Any `no`, or a failed `validateParty`, cancels the party and adds its member set to `vetoed` and `exclude`. If a circle had a cancellation, run `formParties` once more with `attempt: 2`, then step 6 for the new parties only; a second cancellation is final.
  7. `heldBack` = everyone not in a surviving party. `calls` = number of rounds that actually used the model.
  `othersPrivate` for a Companion is the `privateTexts` of every other brief in its circle. Private reasons and verdict details never go into `threads`, `tables`, `groupChat`, `why` or `steps`.
- [ ] **Step 4: Run** the file. Expected: PASS.

---

### Task 6: Wire the room into the queue

**Files:**
- Create: `lib/server/rooms.ts`
- Modify: `lib/match/engine.ts`, `lib/server/queue.ts`, `lib/server/pipeline.ts`, `lib/server/hooks.ts`, `lib/server/preChats.ts`, `lib/ai/index.ts`, `prisma/schema.prisma` (same migration as Task 1 if not yet shipped, else a new one), `tests/helpers/db.ts`
- Delete: `lib/agents/partyFormation.ts`, `lib/agents/companion.ts`, `tests/unit/agent-formation.test.ts`
- Test: `tests/unit/rooms.test.ts`; update `tests/unit/prechats.test.ts`, `tests/unit/queue-service.test.ts`, `tests/unit/trace.test.ts`, `tests/unit/engine.test.ts`, and any other unit test that names `party_formation`

**Interfaces:**
- Consumes: `runRoom`, `ensureBriefs`, `sparksFor`, `groupCohesion`, `formParty`.
- Produces:
  - `engine.eligiblePool(anchor: QueueItem, pool: QueueItem[], people, landmarks, opts: EngineOptions): { items: QueueItem[]; level: number }`: the filter currently inside `findProposal` (same size, `queuesCompatible`, radius, `pairAllowed` with the anchor, fill-mode rules), extracted. `findProposal` calls it. `items` excludes the anchor.
  - `engine.runRoomsAsync(waiting, people, landmarks, opts, match: (anchor: QueueItem, room: QueueItem[], level: number) => Promise<Candidate[]>, commit: (p: Proposal, c: Candidate) => Promise<boolean>): Promise<number>`: same anchor order and simulated-anchor rule as `runTickAsync`. For each untaken anchor: `eligiblePool`; skip if `items.length < anchor.targetSize - 1`; `room` = anchor plus the first `MAX_ROOM - 1` items in the engine's sort order; `match`; each returned candidate is re-checked (`validateParty`, entries untaken, exactly `targetSize`) and committed with a `Proposal` whose `candidates` is `[candidate]`. After a room produces at least one committed party, every entry in that room is treated as taken for the rest of the tick, so leftover fillers cannot form a second squad before they are withdrawn. `queue.tick`'s commit callback now awaits `cleanupSimFor`. `runTickAsync` and `findProposal` stay exported (the "players found" count and existing engine tests use them).
  - Prisma: `MatchRoom { id String @id @default(cuid()); signature String; anchorUserId String; stage String; note String @default(""); result Json?; createdAt DateTime @default(now()); updatedAt DateTime @updatedAt; @@index([anchorUserId]) }`.
  - `rooms.matchRoom(anchor: QueueItem, room: QueueItem[], people: Map<string, Person>): Promise<Candidate[]>`:
    1. `signature` = sorted entry ids joined with `,`. If the in-memory `settled` map says this signature finished with nothing committable, return `[]`.
    2. Create a `MatchRoom` row; `onStage` updates `stage` and `note` and publishes `publish("queue", { type: "stage", stage, note }, realUserIds)`.
    3. `ensureBriefs` (with `useModel` true only for people in a room that has a real user), then `runRoom` with `exclude` = member sets recorded as failed for this signature.
    4. Keep only parties that contain the anchor or any real user. Convert each to `Candidate { entryIds, userIds, eventId: first member's queued event or null, cohesion: groupCohesion(members, makePairScorer()) }`. Store the party's `RoomParty`, its threads and verdict-derived sparks in a `pendingRooms` map keyed by the sorted entry ids.
    5. If no candidate is produced, mark the signature settled.
  - `rooms.markFailed(c: Candidate): void` (adds the member set to that signature's failed sets) and `rooms.takePending(c: Candidate)`.
  - `rooms.roomStageFor(userId: string): Promise<{ stage: string; note: string } | null>` (latest `MatchRoom` whose `result` is null and whose room included the user).
  - `pipeline.formParty`: `rationale` comes from the pending `RoomParty.why` (fallback: the existing `templateRationale`, moved into `pipeline.ts`); after the party is created write the pending trace steps and the pair threads as `PreChat` rows (`transcript`: each thread message as `{ speaker: "A" | "B", text }` with A = the lower id; `sparks`: `sparksFor`; `simulated: true`); when `formParty` returns `null` after a candidate was chosen, call `rooms.markFailed`. `chooseCandidate` is removed.
  - `hooks.afterPartyConfirmed`: drop the `generatePreChats` step. `preChats.ts` keeps only `getPreChatsFor`.
  - `queue.tick`: `runRoomsAsync(..., (anchor, room) => matchRoom(anchor, room, people), commit)`.
  - `queue.scheduleSimulatedFill`: the number of fillers becomes `Number(await getSetting("roomFill", "12")) - 1` when at least one is needed (was `need + 1`), still chosen by the same compatibility and safety logic. `cleanupSimFor` already withdraws the unused ones.
  - `getQueueStatus` waiting state gains `stage?: string` and `stageNote?: string` from `roomStageFor`.
  - `lib/ai/index.ts`: `MAX_LIVE_CALLS` default becomes 400.

- [ ] **Step 1: Write `tests/unit/rooms.test.ts`** (DB tests, `seedDatabase` + `setSetting("simFillMs", "0")` in `beforeEach`, as in the existing `prechats.test.ts`):

```ts
it("a queued user is matched through a room and the party is exactly the chosen size", async () => {
  await joinQueue("p01", { eventId: "ev-indie-guild", targetSize: 5, landmarkId: "lm-downtown-pa", locationSource: "manual" });
  await wait(300);
  expect(await prisma.queueEntry.count({ where: { status: "waiting" } })).toBe(12); // p01 + 11 fillers
  await tick();
  const party = await prisma.party.findFirstOrThrow({ where: { status: "confirmed" }, include: { members: true } });
  expect(party.members).toHaveLength(5);
  expect(party.members.map((m) => m.userId)).toContain("p01");
  expect(party.rationale).toBeTruthy();
  expect(await prisma.queueEntry.count({ where: { status: "waiting" } })).toBe(0); // spare fillers withdrawn
});

it("threads between party members become PreChat rows that feed talk cards", async () => {
  /* same setup */
  const rows = await prisma.preChat.findMany({ where: { partyId: party.id } });
  expect(rows).toHaveLength((5 * 4) / 2);
  expect(rows.every((r) => r.simulated && (r.transcript as unknown[]).length >= 6 && (r.sparks as string[]).length >= 1)).toBe(true);
  const cards = await getTalkCards(party.id, "p01");
  expect(cards.flatMap((c) => c.content.claims.filter((x) => x.kind === "spark")).length).toBe(4);
});

it("the trace starts with the orchestrator and has companion, safety and decision steps", async () => {
  const t = await getTrace(party.id);
  expect(t[0].agent).toBe("orchestrator");
  expect(t.some((s) => s.agent === "companion" && s.toolName === "companionRounds")).toBe(true);
  expect(t.some((s) => s.kind === "safety_check")).toBe(true);
  expect(t.some((s) => s.agent === "event_selection" && s.kind === "decision")).toBe(true);
});

it("each Companion prompt holds one full brief; sensitive model text never reaches a PreChat", async () => {
  mockProvider().on("companion_ask", () => JSON.stringify({ asks: {} })).on("companion_answer", () => JSON.stringify({ answers: Object.fromEntries(/* every id */ ids.map((i) => [i, { say: "Do they go to church?", cites: [] }])), verdicts: {}, picks: [] }));
  /* run */
  for (const c of mockProvider().calls.filter((x) => x.task.startsWith("companion_") && x.task !== "companion_brief")) {
    expect(Object.keys(JSON.parse(c.messages[1].content))).toContain("your_brief");
    expect(c.messages[1].content.match(/"ownerId"/g)).toHaveLength(1);
  }
  expect(JSON.stringify(await prisma.preChat.findMany())).not.toMatch(/church/i);
});

it("leaving the queue mid-run drops only that party", async () => {
  // a companion_group2 handler that calls leaveQueue("p01") on its first invocation, then answers yes
  /* run tick */
  expect(await prisma.party.count({ where: { status: "confirmed", members: { some: { userId: "p01" } } } })).toBe(0);
  expect(await prisma.queueEntry.count({ where: { status: "matched", partyId: null } })).toBe(0);
});

it("a room whose pick has no usable event is not retried until the room changes", async () => {
  setEventChooser(async () => null);                       // and make selectEventFallback fail: delete the events
  await prisma.event.deleteMany({ where: { kind: "event" } });
  /* join in "any event" mode, tick twice */
  const afterFirst = mockProvider().calls.length;
  await tick();
  expect(mockProvider().calls.length).toBe(afterFirst);   // settled signature: no second room run
  expect(await prisma.party.count({ where: { status: "confirmed" } })).toBe(0);
  expect(await prisma.queueEntry.count({ where: { status: "matched" } })).toBe(0);
});

it("an all-simulated room spends no model calls", async () => {
  await setSetting("fillMode", "simulated");               // use the setting key the app already uses for fill mode
  /* enqueue 8 simulated users directly, tick */
  expect(mockProvider().calls).toHaveLength(0);
});

it("getQueueStatus reports the room stage while a room is running", async () => {
  // a companion_ask handler that awaits getQueueStatus("p01") and records it
  expect(seen.stage).toBe("mingling");
});
```

Fill in the elided setup following `tests/unit/prechats.test.ts`. Rewrite that file's two cases into the cases above and delete it.

- [ ] **Step 2: Add engine tests** to `tests/unit/engine.test.ts`: `eligiblePool` returns the same people `findProposal` considered (same size, queue, radius, safety); `runRoomsAsync` skips an anchor with fewer than `targetSize - 1` eligible, never commits a candidate with a taken entry, a wrong size, or a `validateParty` failure, and caps the room at `MAX_ROOM`.
- [ ] **Step 3: Run** `pnpm exec vitest run tests/unit/rooms.test.ts tests/unit/engine.test.ts`. Expected: FAIL.
- [ ] **Step 4: Implement** the engine changes, `rooms.ts`, and the pipeline, hooks, queue and `preChats.ts` edits. Add `MatchRoom` and `CompanionBrief` to `resetDb`. Delete the two old agent files and `agent-formation.test.ts`.
- [ ] **Step 5: Update the remaining unit tests** that expect `party_formation` (`queue-service.test.ts`, `trace.test.ts`) to the new agents, keeping what each test was proving (a trace exists, safety is re-checked in code, two decisions are recorded).
- [ ] **Step 6: Run** `pnpm test`. Expected: PASS, with no reference to `partyFormationAgent`, `chooseCandidate`, `runPreChat` or `generatePreChats` left (`git grep`).

---

### Task 7: UI

**Files:**
- Create: `app/api/companion/brief/route.ts`, `app/api/companion/brief/share/route.ts`, `components/companion/BriefCard.tsx`
- Modify: `app/(app)/profile/page.tsx`, `components/queue/QueueSetup.tsx`, `components/queue/QueueScreen.tsx`, `components/trace/MatchTracePanel.tsx`, `components/cards/TalkCardDeck.tsx`
- Test: `tests/unit/companion-api.test.ts`, `tests/e2e/companion.spec.ts`; update `tests/e2e/screens.spec.ts`

**Interfaces:**
- Consumes: `getBriefFor`, `setShare`, `getQueueStatus().stage`.
- Produces:
  - `GET /api/companion/brief` -> `{ facts: Fact[]; tonight; communication }` for the current user (template brief, no model call).
  - `POST /api/companion/brief/share` body `{ factId, share }` -> 200 `{ ok: true }`, 404 `unknown_fact`, 422 `bad_share`.

- [ ] **Step 1: API tests** (`companion-api.test.ts`): GET returns the current user's facts and no sensitive item; POST persists a share and the next GET shows it; unknown fact is 404; bad share is 422.
- [ ] **Step 2: `BriefCard`** ("What your Companion will say about you"): each fact with a three-way control (Share / Only as a need / Keep private), plus the communication line. Test ids: `brief-card`, `brief-fact`, `brief-share-<share>`. Show it on `/profile`, and a one-line link to it from `QueueSetup` ("Your Companion will speak for you. Review what it can share.").
- [ ] **Step 3: `QueueScreen`**: under "Players found", when `status.stage` is set, show a stage line (`data-testid="room-stage"`) with these labels: `briefing` "Companions are reading profiles", `circles` "Finding your circle", `mingling` "Your Companion is meeting everyone", `deep` "Going deeper with a few people", `deliberating` "Companions are proposing squads", `forming` "Forming your squad", `group` "Your squad's Companions are talking it over". Handle the `stage` event from `useLiveEvents(["queue"])` and the existing polling fallback.
- [ ] **Step 4: `MatchTracePanel`**: add `orchestrator: "Orchestrator"` and change `companion` to "Companions"; remove `party_formation`.
- [ ] **Step 5: `TalkCardDeck`**: the pre-chat section title becomes "What your Companions talked about"; show the whole thread (it can now be 6 or 10 lines) in a scrollable box capped at about 16rem, and a "went deeper" tag when it has more than 6 lines. Keep the existing "AI simulation" label.
- [ ] **Step 6: E2E** (`companion.spec.ts`, using `gotoReady` and the existing helpers): on `/profile` the brief card lists facts and a share toggle persists across reload; queueing from the demo event reaches "Party found!" with the chosen size; the trace panel shows "Orchestrator" and "Companions" steps; the cards screen shows a Companion thread for a squadmate. Update `screens.spec.ts` to capture the brief card and the queue stage line into `docs/screens/`.
- [ ] **Step 7: Run** `pnpm test` and `pnpm test:e2e`. Expected: PASS. Open the new screenshots and check them at iPhone width: no overflow, no empty cards.

---

### Task 8: Warm the cache, document, final check

**Files:**
- Modify: `scripts/warm-ai-cache.ts`, `data/ai-cache/*`, `README.md`, `.env.example`

- [ ] **Step 1: Clear stale cache entries.** Delete `data/ai-cache/party_formation-*.json` and `companion_prechat-*.json`. The other entries are re-created by warming because their prompts depend on who is in the party.
- [ ] **Step 2: Update `warm-ai-cache.ts`**: raise `AI_TIMEOUT_MS` default to `120000`, print the number of live calls per path and the count per task from `aiLog()`, and print how many results were `fallback`.
- [ ] **Step 3: Warm with real Muse.** `pnpm ai:warm` in the background with `MODEL_API_KEY` set in `.env`. Expect roughly 90-110 calls for the scripted path (a room of 12 in one circle) and the same again for each other path. It must finish with a confirmed party containing `p01` on every path and zero `fallback` results among the Companion and Orchestrator tasks for the scripted path. If Muse drops partners or truncates in the large batched calls, add a `COMPANION_BATCH` env setting (max partners per call, default the whole circle), split the rounds into several calls, and warm again. Report the real call counts and time.
- [ ] **Step 4: Offline check.** With `AI_MODE=cache` and no key: `pnpm build && pnpm start`, reset from `/demo`, run the scripted path by hand, and confirm from `/demo`'s AI log (or `aiLog()`) that the Companion and Orchestrator tasks came from `cache`, not `fallback`. If any miss, a prompt is not deterministic: find the differing field, fix it, add it to the determinism test in Task 5, and warm again.
- [ ] **Step 5: Docs.** README: the "Pipeline when a squad forms" steps, the Mermaid diagram's agent box, the rubric row on AI integration, the call count in the `ai:warm` note, and a privacy bullet on briefs and share levels. `.env.example`: `AI_MAX_CALLS` note and `COMPANION_BATCH` if added.
- [ ] **Step 6: Final run.** `pnpm test:all` passes. Do not commit.
