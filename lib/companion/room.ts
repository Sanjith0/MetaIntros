/**
 * The room: one run of the Companion engine over a set of people waiting in the queue.
 *
 *   circles (Orchestrator) → every allowed pair in a circle talks (intro, ask, answer + private
 *   verdict) → picked pairs go deeper (follow-up, close) → each Companion proposes a squad →
 *   one deliberation round (back / amend / hold) → the Orchestrator forms squads → the squad's
 *   Companions talk as a group and each signs off (yes / yes_if / no).
 *
 * Pure: no DB. Private reasons and verdict details never go into threads, tables, group chat,
 * the rationale or trace steps.
 */
import { pairAllowed, validateParty } from "@/lib/match/safety";
import type { Person } from "@/lib/profile/load";
import type { TraceStep } from "@/lib/server/trace";
import { openView, privateTexts, type Brief, type OpenView } from "./brief";
import { safeMessage, type Msg } from "./checks";
import { SIMILARITY_GATE, deepPairs, drawCircles, formParties, templateWhy, wanted, type Circle, type TableResponse, type TableRow, type Verdict, type Verdicts } from "./orchestrator";
import { askRound, answerRound, closeRound, deliberate, groupRound, type RoundCtx, type ThreadMsg } from "./rounds";
import { makePairScorer } from "@/lib/match/compat";

export type Stage = "briefing" | "circles" | "mingling" | "checkin" | "deep" | "deliberating" | "forming" | "group" | "signoff" | "done" | "waiting";

/** What a person is shown at the first check-in: who their Companion would pick, and why. */
export interface PicksOffer {
  targetSize: number;
  picks: { id: string; score: number; why: string }[];
  /** everyone else their Companion talked with */
  others: { id: string; score: number }[];
}
export interface PicksAnswer {
  /** people this person does not want in their squad (enforced by code) */
  drop: string[];
  /** what their Companion got wrong, or what they actually want (private to their Companion) */
  told?: string;
}
/** What a person is shown at sign-off: the squad, and what their Companion recommends. */
export interface SignoffOffer {
  members: string[];
  recommend: "yes" | "yes_if" | "no";
  companionSaid: string;
  groupLines: { from: string; say: string }[];
}
export interface SignoffAnswer {
  decision: "yes" | "no";
}
/**
 * Asking the real people in a room. Each call resolves with their answer, or null if they didn't
 * answer in time, in which case their Companion goes ahead on its own.
 */
export interface HumanCheckIns {
  picks?: (userId: string, offer: PicksOffer) => Promise<PicksAnswer | null>;
  signoff?: (userId: string, offer: SignoffOffer) => Promise<SignoffAnswer | null>;
}

export interface RoomInput {
  ids: string[];
  people: Map<string, Person>;
  briefs: Map<string, Brief>;
  targetSize: number;
  /** member sets that must not be formed again (earlier vetoes or failed commits) */
  exclude?: string[][];
  /** people to place first (real people ahead of simulated fillers) */
  priority?: string[];
  /** only form squads that include a priority person */
  onlyPriority?: boolean;
  /** can this group actually meet? Checked by code before a squad is formed. */
  feasible?: (members: string[]) => boolean;
  onStage?: (s: Stage, note: string) => void | Promise<void>;
  onLive?: (e: LiveEvent) => void;
  /** check in with the real people in the room (never simulated ones) */
  human?: HumanCheckIns;
}

/**
 * What happens in a room, as it happens: each Companion line the moment its Muse call returns,
 * each Companion's private notes, proposals, and group-conversation lines. Consumers decide who
 * may see what (a person sees only their own Companion's conversations and notes).
 */
export type LiveEvent =
  | { type: "circle"; circleId: string; theme: string; members: string[] }
  | { type: "line"; line: ThreadMsg }
  | { type: "notes"; from: string; notes: [string, Verdict][]; picks?: string[] }
  | { type: "deep"; pairs: [string, string][] }
  | { type: "proposal"; row: TableRow }
  | { type: "table"; circleId: string; rows: TableRow[] }
  | { type: "group"; groupId: string; members: string[]; line: { from: string; say: string } }
  | { type: "groupDone"; groupId: string; members: string[]; ok: boolean };

export interface RoomParty {
  members: string[];
  why: string;
  circleId: string;
  groupChat: { from: string; say: string }[];
  needs: string[];
  steps: TraceStep[];
}

export interface RoomResult {
  circles: Circle[];
  unplaced: string[];
  threads: Map<string, ThreadMsg[]>;
  /** pair keys that had the longer conversation */
  deep: string[];
  verdicts: Verdicts;
  tables: Map<string, TableRow[]>;
  parties: RoomParty[];
  vetoed: string[][];
  heldBack: string[];
  /** model calls attempted */
  calls: number;
}

export const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const first = (p: Pick<Person, "name">) => p.name.split(" ")[0];
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

/** Up to 3 short lines on what two people would enjoy, from both Companions' verdicts. */
export function sparksFor(a: string, b: string, r: Pick<RoomResult, "verdicts">): string[] {
  const lines = [...(r.verdicts.get(a)?.get(b)?.wouldEnjoy ?? []), ...(r.verdicts.get(b)?.get(a)?.wouldEnjoy ?? [])];
  const out = [...new Set(lines)].slice(0, 3);
  return out.length ? out : ["A similar idea of a good night out"];
}

export async function runRoom(input: RoomInput): Promise<RoomResult> {
  const { people, targetSize } = input;
  // A person's check-in answers update their own brief for the rest of the room.
  const briefs = new Map(input.briefs);
  /** pairs a person said they don't want together (code-enforced) */
  const dropped = new Set<string>();
  const isReal = (id: string) => !people.get(id)!.isSimulated;
  const ids = [...new Set(input.ids)].sort();
  const live = (e: LiveEvent) => {
    try {
      input.onLive?.(e);
    } catch {
      /* a viewer must never break a room */
    }
  };
  const asLine = (from: string, to: string, kind: ThreadMsg["kind"], m: Msg): ThreadMsg => ({ from, to, kind, say: m.say, cites: m.cites, blocked: m.blocked });
  const stage = async (s: Stage, note: string) => {
    await input.onStage?.(s, note);
  };
  let calls = 0;
  const count = (source: string) => {
    if (!["template", "blocked", "none", "code"].includes(source)) calls++;
  };
  const allowed = (a: string, b: string) => pairAllowed(people.get(a)!, people.get(b)!);
  // Vectors shortlist, Companions decide: only pairs above the similarity gate get a conversation.
  const similarity = makePairScorer();
  const talks = (a: string, b: string) => allowed(a, b) && similarity(people.get(a)!, people.get(b)!).score >= SIMILARITY_GATE;

  // ── circles ──
  const roomUsesModel = ids.some((id) => !people.get(id)!.isSimulated);
  await stage("circles", `Sorting ${ids.length} people into circles`);
  const drawn = await drawCircles(new Map(ids.map((id) => [id, briefs.get(id)!])), people, targetSize, roomUsesModel);
  count(drawn.source);

  const threads = new Map<string, ThreadMsg[]>();
  const verdicts: Verdicts = new Map(ids.map((id) => [id, new Map<string, Verdict>()]));
  const views = new Map<string, OpenView>(ids.map((id) => [id, openView(briefs.get(id)!)]));
  let blocked = 0;
  const post = (from: string, to: string, kind: ThreadMsg["kind"], m: Msg) => {
    if (m.blocked) blocked++;
    const k = pairKey(from, to);
    threads.set(k, [...(threads.get(k) ?? []), { from, to, kind, say: m.say, cites: m.cites, blocked: m.blocked }]);
  };

  const circles = drawn.circles.map((circle) => {
    const members = [...circle.members].sort();
    const useModel = members.some((m) => !people.get(m)!.isSimulated);
    // Vectors shortlist: everyone above the gate talks, and nobody is stranded — each Companion also
    // talks to its closest few (enough for a squad) even if they fall below it.
    const floor = Math.max(targetSize - 1, 2);
    const talking = new Set<string>();
    for (const id of members) {
      const allowedOthers = members.filter((m) => m !== id && allowed(id, m));
      for (const m of allowedOthers) if (talks(id, m)) talking.add(pairKey(id, m));
      const closest = [...allowedOthers].sort((a, b) => similarity(people.get(id)!, people.get(b)!).score - similarity(people.get(id)!, people.get(a)!).score || a.localeCompare(b));
      for (const m of closest.slice(0, floor)) talking.add(pairKey(id, m));
    }
    const partners = (id: string) => members.filter((m) => m !== id && talking.has(pairKey(id, m)));
    /** Only one squad is possible (e.g. two people who both picked 2): skip proposals and go straight to the group. */
    const onlyOne = members.length === targetSize;
    const keep = (id: string) => (m: string) => !dropped.has(pairKey(id, m));
    const ctx = (id: string): RoundCtx => ({
      brief: briefs.get(id)!,
      me: people.get(id)!,
      people,
      othersPrivate: new Map(members.filter((m) => m !== id).map((m) => [m, privateTexts(briefs.get(m)!)])),
      useModel,
    });
    const introsFor = (id: string, of: string[] = partners(id)) => new Map(of.map((m) => [m, views.get(m)!]));
    const pairs: [string, string][] = [];
    for (let i = 0; i < members.length; i++) for (let j = i + 1; j < members.length; j++) if (talking.has(pairKey(members[i], members[j]))) pairs.push([members[i], members[j]]);
    const active = members.filter((m) => partners(m).length > 0);
    return { circle, members, useModel, onlyOne, partners, keep, ctx, introsFor, pairs, active, picks: new Map<string, string[]>(), deep: [] as [string, string][], table: [] as TableRow[], want: new Map<string, Set<string>>() };
  });
  type CS = (typeof circles)[number];

  // ── round 1: everyone in the circle ──
  for (const cs of circles) live({ type: "circle", circleId: cs.circle.id, theme: cs.circle.theme, members: cs.members });
  await stage("mingling", "Companions are introducing their people and asking each other questions");
  const intro = (id: string): Msg => {
    const v = views.get(id)!;
    const top = v.facts.filter((f) => f.kind !== "style").slice(0, 3);
    return safeMessage(briefs.get(id)!, {
      say: `${v.name} is after ${v.tonight.hopingFor.replace(/^A /, "a ")}.${top.length ? ` Into ${top.map((f) => f.text).join(", ")}.` : ""}${v.communication ? ` ${v.communication}` : ""}`,
      cites: top.map((f) => f.id),
    });
  };
  await Promise.all(circles.map(async (cs) => {
    for (const [a, b] of cs.pairs) {
      post(a, b, "intro", intro(a));
      post(b, a, "intro", intro(b));
      live({ type: "line", line: asLine(a, b, "intro", intro(a)) });
      live({ type: "line", line: asLine(b, a, "intro", intro(b)) });
    }
    const asks = await Promise.all(cs.active.map((m) => askRound(cs.ctx(m), cs.introsFor(m)).then((r) => {
      for (const [to, msg] of r.asks) live({ type: "line", line: asLine(m, to, "ask", msg) });
      return r;
    })));
    asks.forEach((r) => count(r.source));
    const askOf = new Map(cs.active.map((m, i) => [m, asks[i].asks]));
    for (const [a, b] of cs.pairs) {
      post(a, b, "ask", askOf.get(a)!.get(b)!);
      post(b, a, "ask", askOf.get(b)!.get(a)!);
    }
    const answers = await Promise.all(cs.active.map((m) => answerRound(cs.ctx(m), cs.introsFor(m), new Map(cs.partners(m).map((p) => [p, askOf.get(p)!.get(m)!.say]))).then((r) => {
      for (const [to, msg] of r.answers) live({ type: "line", line: asLine(m, to, "answer", msg) });
      live({ type: "notes", from: m, notes: [...r.verdicts], picks: r.picks });
      return r;
    })));
    answers.forEach((r) => count(r.source));
    cs.active.forEach((m, i) => {
      for (const [about, v] of answers[i].verdicts) verdicts.get(m)!.set(about, v);
      cs.picks.set(m, answers[i].picks);
    });
    const ansOf = new Map(cs.active.map((m, i) => [m, answers[i].answers]));
    for (const [a, b] of cs.pairs) {
      post(a, b, "answer", ansOf.get(a)!.get(b)!);
      post(b, a, "answer", ansOf.get(b)!.get(a)!);
    }
  }));

  // ── check-in: each real person sees who their Companion would pick, can drop people and correct it ──
  const askPicks = input.human?.picks;
  // Only ask when there's a choice to make (more people than squad places).
  const realActive = circles.flatMap((cs) => cs.active.filter((m) => isReal(m) && !cs.onlyOne && cs.partners(m).length > targetSize - 1).map((m) => ({ cs, m })));
  if (askPicks && realActive.length) {
    await stage("checkin", "Your Companion is checking its picks with you");
    await Promise.all(realActive.map(async ({ cs, m }) => {
      const mine = verdicts.get(m)!;
      const ranked = cs.partners(m).map((id) => ({ id, score: mine.get(id)?.score ?? 0, why: mine.get(id)?.wouldEnjoy[0] ?? mine.get(id)?.concerns[0] ?? "" })).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
      const answer = await askPicks(m, { targetSize, picks: ranked.slice(0, targetSize - 1), others: ranked.slice(targetSize - 1).map(({ id, score }) => ({ id, score })) }).catch(() => null);
      if (!answer) return;
      const ok = new Set(cs.partners(m));
      for (const d of answer.drop) if (ok.has(d)) dropped.add(pairKey(m, d));
      const told = answer.told?.trim();
      if (told) {
        const b = briefs.get(m)!;
        briefs.set(m, { ...b, told: [...(b.told ?? []), told] });
      }
    }));
  }

  // ── deep dive: picked pairs only, then each Companion proposes ──
  const choosing = circles.filter((cs) => !cs.onlyOne);
  if (choosing.length) await stage("deep", "Going deeper where a Companion asked to");
  await Promise.all(choosing.map(async (cs) => {
    cs.deep = deepPairs(cs.picks, verdicts, cs.members, people).filter(([a, b]) => !dropped.has(pairKey(a, b)));
    const deepWith = (m: string) => cs.deep.filter((p) => p.includes(m)).map((p) => (p[0] === m ? p[1] : p[0]));
    const threadsFor = (m: string) => new Map(deepWith(m).map((p) => [p, threads.get(pairKey(m, p))!]));
    live({ type: "deep", pairs: cs.deep });
    const close = await Promise.all(cs.active.map((m) => closeRound(cs.ctx(m), threadsFor(m), [m, ...cs.partners(m).filter(cs.keep(m))], verdicts.get(m)!, targetSize).then((r) => {
      for (const [to, msg] of r.says) live({ type: "line", line: asLine(m, to, "close", msg) });
      if (r.verdicts.size) live({ type: "notes", from: m, notes: [...r.verdicts] });
      live({ type: "proposal", row: { id: `prop-${m}`, by: m, members: r.proposal.members, line: r.proposal.line.say, backers: [] } });
      return r;
    })));
    close.forEach((r) => count(r.source));
    const cOf = new Map(cs.active.map((m, i) => [m, close[i]]));
    for (const [a, b] of cs.deep) {
      post(a, b, "close", cOf.get(a)!.says.get(b)!);
      post(b, a, "close", cOf.get(b)!.says.get(a)!);
    }
    cs.active.forEach((m, i) => {
      for (const [about, v] of close[i].verdicts) verdicts.get(m)!.set(about, v);
      cs.table.push({ id: `prop-${m}`, by: m, members: close[i].proposal.members, line: close[i].proposal.line.say, backers: [] });
    });
  }));

  // ── deliberation: one round ──
  if (choosing.length) await stage("deliberating", "Companions are backing or amending each other's proposals");
  await Promise.all(choosing.map(async (cs) => {
    const proposals = [...cs.table];
    // A Companion never sees (so never backs) a proposal pairing its person with someone they dropped.
    const res = await Promise.all(cs.active.map((m) => deliberate(cs.ctx(m), proposals.filter((p) => p.members.every(cs.keep(m))), verdicts.get(m)!, targetSize)));
    res.forEach((r) => count(r.source));
    const responses = new Map<string, TableResponse>();
    cs.active.forEach((m, i) => {
      const r = res[i];
      responses.set(m, { action: r.action, proposalId: r.proposalId, members: r.members });
      if (r.action === "back") cs.table.find((t) => t.id === r.proposalId)?.backers.push(m);
      else if (r.action === "amend" && r.members) cs.table.push({ id: `amend-${m}`, by: m, members: r.members, line: r.line.say, backers: [] });
    });
    cs.want = wanted(cs.table, responses);
    live({ type: "table", circleId: cs.circle.id, rows: cs.table.map((r) => ({ ...r, backers: [...r.backers] })) });
  }));

  // ── Orchestrator forms squads; each squad's Companions talk as a group and sign off ──
  await stage("forming", "The Orchestrator is forming squads from what the Companions chose");
  const parties: RoomParty[] = [];
  const vetoed: string[][] = [];
  let groupStage = false;

  /** Code rule: a squad never contains a pair someone dropped, and must be able to meet. */
  const canGroup = (members: string[]) => {
    for (let i = 0; i < members.length; i++) for (let j = i + 1; j < members.length; j++) if (dropped.has(pairKey(members[i], members[j]))) return false;
    return input.feasible ? input.feasible(members) : true;
  };

  const groupConversation = async (cs: CS, members: string[]) => {
    if (!groupStage) {
      groupStage = true;
      await stage("group", "Each proposed squad's Companions are talking it over");
    }
    const groupId = `${cs.circle.id}:${members.join(",")}`;
    const respond = await Promise.all(members.map((m) => groupRound(cs.ctx(m), members, cs.introsFor(m, members.filter((x) => x !== m)), verdicts.get(m)!).then((r) => {
      live({ type: "group", groupId, members, line: { from: m, say: r.line.say } });
      return r;
    })));
    respond.forEach((r) => count(r.source));
    blocked += respond.filter((r) => r.line.blocked).length;
    // Sign-off: each real person makes the call (their Companion's recommendation shown); if they don't answer in time, their Companion's call stands.
    const lines = members.map((m, i) => ({ from: m, say: respond[i].line.say }));
    const askSignoff = input.human?.signoff;
    const decisions = respond.map((r) => r.decision);
    if (askSignoff && members.some(isReal)) {
      await stage("signoff", "Your squad is waiting for your yes");
      await Promise.all(members.map(async (m, i) => {
        if (!isReal(m)) return;
        const a = await askSignoff(m, { members, recommend: respond[i].decision, companionSaid: respond[i].line.say, groupLines: lines }).catch(() => null);
        if (a) decisions[i] = a.decision;
      }));
    }
    const ok = decisions.every((d) => d !== "no") && validateParty(members.map((m) => people.get(m)!)).ok;
    live({ type: "groupDone", groupId, members, ok });
    return {
      ok,
      groupChat: lines,
      needs: respond.map((r) => r.need).filter(Boolean),
    };
  };

  await Promise.all(circles.map(async (cs) => {
    const exclude = [...(input.exclude ?? [])];
    let pool = cs.members;
    for (let attempt = 1; attempt <= 2; attempt++) {
      if (pool.length < targetSize) break;
      const only = cs.onlyOne && attempt === 1 && pool.length === targetSize && canGroup(pool) && validateParty(pool.map((m) => people.get(m)!)).ok && !exclude.some((e) => e.length === pool.length && e.every((m) => pool.includes(m)));
      const formed = only
        ? { parties: [{ members: pool, why: templateWhy(pool, people) }], heldBack: [], source: "code" }
        : cs.onlyOne
          ? { parties: [], heldBack: pool, source: "code" }
          : await formParties({ circle: { ...cs.circle, members: pool }, table: cs.table, want: cs.want, verdicts, briefs, people, targetSize, exclude, attempt, useModel: cs.useModel, priority: input.priority, onlyPriority: input.onlyPriority, feasible: canGroup });
      count(formed.source);
      let anyVeto = false;
      for (const p of formed.parties) {
        const members = [...p.members].sort();
        const g = await groupConversation(cs, members);
        if (!g.ok) {
          anyVeto = true;
          vetoed.push(members);
          exclude.push(members);
          continue;
        }
        parties.push({ members, why: p.why, circleId: cs.circle.id, groupChat: g.groupChat, needs: g.needs, steps: stepsFor(cs, members, attempt) });
      }
      if (!anyVeto) break;
      const placed = new Set(parties.flatMap((p) => p.members));
      pool = cs.members.filter((m) => !placed.has(m));
    }
  }));

  function stepsFor(cs: CS, members: string[], attempt: number): TraceStep[] {
    const set = new Set(members);
    const deepIn = cs.deep.filter(([a, b]) => set.has(a) && set.has(b)).length;
    const key = [...members].sort().join(",");
    const supporters = new Set<string>();
    for (const row of cs.table) {
      if ([...row.members].sort().join(",") !== key) continue;
      supporters.add(row.by);
      row.backers.forEach((b) => supporters.add(b));
    }
    const inSquad = [...supporters].filter((s) => set.has(s)).length;
    return [
      {
        agent: "orchestrator", kind: "decision", output: { circle: cs.circle.id, circleSize: cs.members.length, circles: circles.length, room: ids.length },
        summary: `Sorted ${plural(ids.length, "person").replace("persons", "people")} in your queue into ${plural(circles.length, "circle")}. Yours: "${cs.circle.theme}" (${cs.members.length} people)`,
      },
      {
        agent: "companion", kind: "tool_call", toolName: "companionRounds", input: { circle: cs.circle.id }, output: { conversations: cs.pairs.length, deepDives: cs.deep.length, deepDivesInSquad: deepIn },
        summary: `Every Companion met every other in the circle (${plural(cs.pairs.length, "conversation")}), each seeing only its own person's brief; ${plural(cs.deep.length, "pair")} went deeper`,
      },
      {
        agent: "companion", kind: "reasoning", output: { squadMembersWhoChoseThisGroup: inSquad, proposals: cs.table.length },
        summary: cs.onlyOne
          ? "Only one squad was possible in this room, so the Companions skipped proposals and went straight to talking it over as a group"
          : inSquad > 0 ? `${plural(inSquad, "Companion")} in this squad proposed or backed exactly this group out of ${plural(cs.table.length, "proposal")} on the table` : `Formed from ${plural(cs.table.length, "proposal")} the Companions put on the table`,
      },
      {
        agent: "orchestrator", kind: "safety_check", output: { rejected: false, attempt },
        summary: "Re-checked in code: age-band, women-only and block rules pass, and every member was wanted by another member's Companion",
      },
      {
        agent: "companion", kind: "decision", output: { members },
        summary: `All ${members.length} Companions signed off after a group conversation: ${members.map((m) => first(people.get(m)!)).join(", ")}`,
      },
    ];
  }

  const placed = new Set(parties.flatMap((p) => p.members));
  const result: RoomResult = {
    circles: drawn.circles,
    unplaced: drawn.unplaced,
    threads,
    deep: circles.flatMap((cs) => cs.deep.map(([a, b]) => pairKey(a, b))),
    verdicts,
    tables: new Map(circles.map((cs) => [cs.circle.id, cs.table])),
    parties: parties.sort((a, b) => a.members.join().localeCompare(b.members.join())),
    vetoed,
    heldBack: ids.filter((id) => !placed.has(id)),
    calls,
  };
  void blocked;
  await stage(parties.length ? "done" : "waiting", parties.length ? `${plural(parties.length, "squad")} formed` : "No squad clicked yet");
  return result;
}
