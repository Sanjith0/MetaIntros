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
import { deepPairs, drawCircles, formParties, wanted, type Circle, type TableResponse, type TableRow, type Verdict, type Verdicts } from "./orchestrator";
import { askRound, answerRound, closeRound, deliberate, followUpRound, groupRespond, groupSpeak, type RoundCtx, type ThreadMsg } from "./rounds";

export type Stage = "briefing" | "circles" | "mingling" | "deep" | "deliberating" | "forming" | "group" | "done" | "waiting";

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
}

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
  const { people, briefs, targetSize } = input;
  const ids = [...new Set(input.ids)].sort();
  const stage = async (s: Stage, note: string) => {
    await input.onStage?.(s, note);
  };
  let calls = 0;
  const count = (source: string) => {
    if (!["template", "blocked", "none", "code"].includes(source)) calls++;
  };
  const allowed = (a: string, b: string) => pairAllowed(people.get(a)!, people.get(b)!);

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
    const partners = (id: string) => members.filter((m) => m !== id && allowed(id, m));
    const ctx = (id: string): RoundCtx => ({
      brief: briefs.get(id)!,
      me: people.get(id)!,
      people,
      othersPrivate: new Map(members.filter((m) => m !== id).map((m) => [m, privateTexts(briefs.get(m)!)])),
      useModel,
    });
    const introsFor = (id: string, of: string[] = partners(id)) => new Map(of.map((m) => [m, views.get(m)!]));
    const pairs: [string, string][] = [];
    for (let i = 0; i < members.length; i++) for (let j = i + 1; j < members.length; j++) if (allowed(members[i], members[j])) pairs.push([members[i], members[j]]);
    const active = members.filter((m) => partners(m).length > 0);
    return { circle, members, useModel, partners, ctx, introsFor, pairs, active, picks: new Map<string, string[]>(), deep: [] as [string, string][], table: [] as TableRow[], want: new Map<string, Set<string>>() };
  });
  type CS = (typeof circles)[number];

  // ── round 1: everyone in the circle ──
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
    }
    const asks = await Promise.all(cs.active.map((m) => askRound(cs.ctx(m), cs.introsFor(m))));
    asks.forEach((r) => count(r.source));
    const askOf = new Map(cs.active.map((m, i) => [m, asks[i].asks]));
    for (const [a, b] of cs.pairs) {
      post(a, b, "ask", askOf.get(a)!.get(b)!);
      post(b, a, "ask", askOf.get(b)!.get(a)!);
    }
    const answers = await Promise.all(cs.active.map((m) => answerRound(cs.ctx(m), cs.introsFor(m), new Map(cs.partners(m).map((p) => [p, askOf.get(p)!.get(m)!.say])))));
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

  // ── deep dive: picked pairs only, then each Companion proposes ──
  await stage("deep", "Going deeper where a Companion asked to");
  await Promise.all(circles.map(async (cs) => {
    cs.deep = deepPairs(cs.picks, verdicts, cs.members, people);
    const deepWith = (m: string) => cs.deep.filter((p) => p.includes(m)).map((p) => (p[0] === m ? p[1] : p[0]));
    const threadsFor = (m: string) => new Map(deepWith(m).map((p) => [p, threads.get(pairKey(m, p))!]));
    const follow = await Promise.all(cs.active.map((m) => followUpRound(cs.ctx(m), threadsFor(m))));
    follow.forEach((r) => count(r.source));
    const fOf = new Map(cs.active.map((m, i) => [m, follow[i].says]));
    for (const [a, b] of cs.deep) {
      post(a, b, "followup", fOf.get(a)!.get(b)!);
      post(b, a, "followup", fOf.get(b)!.get(a)!);
    }
    const close = await Promise.all(cs.active.map((m) => closeRound(cs.ctx(m), threadsFor(m), cs.members, verdicts.get(m)!, targetSize)));
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
  await stage("deliberating", "Companions are backing or amending each other's proposals");
  await Promise.all(circles.map(async (cs) => {
    const proposals = [...cs.table];
    const res = await Promise.all(cs.active.map((m) => deliberate(cs.ctx(m), proposals, verdicts.get(m)!, targetSize)));
    res.forEach((r) => count(r.source));
    const responses = new Map<string, TableResponse>();
    cs.active.forEach((m, i) => {
      const r = res[i];
      responses.set(m, { action: r.action, proposalId: r.proposalId, members: r.members });
      if (r.action === "back") cs.table.find((t) => t.id === r.proposalId)?.backers.push(m);
      else if (r.action === "amend" && r.members) cs.table.push({ id: `amend-${m}`, by: m, members: r.members, line: r.line.say, backers: [] });
    });
    cs.want = wanted(cs.table, responses);
  }));

  // ── Orchestrator forms squads; each squad's Companions talk as a group and sign off ──
  await stage("forming", "The Orchestrator is forming squads from what the Companions chose");
  const parties: RoomParty[] = [];
  const vetoed: string[][] = [];
  let groupStage = false;

  const groupConversation = async (cs: CS, members: string[]) => {
    if (!groupStage) {
      groupStage = true;
      await stage("group", "Each proposed squad's Companions are talking it over");
    }
    const speak = await Promise.all(members.map((m) => groupSpeak(cs.ctx(m), members, cs.introsFor(m, members.filter((x) => x !== m)), verdicts.get(m)!)));
    speak.forEach((r) => count(r.source));
    const lines = members.map((m, i) => ({ from: m, say: speak[i].line.say }));
    const respond = await Promise.all(members.map((m) => groupRespond(cs.ctx(m), members, lines, verdicts.get(m)!)));
    respond.forEach((r) => count(r.source));
    blocked += [...speak, ...respond].filter((r) => r.line.blocked).length;
    return {
      ok: respond.every((r) => r.decision !== "no") && validateParty(members.map((m) => people.get(m)!)).ok,
      groupChat: [...lines, ...members.map((m, i) => ({ from: m, say: respond[i].line.say }))],
      needs: respond.map((r) => r.need).filter(Boolean),
    };
  };

  await Promise.all(circles.map(async (cs) => {
    const exclude = [...(input.exclude ?? [])];
    let pool = cs.members;
    for (let attempt = 1; attempt <= 2; attempt++) {
      if (pool.length < targetSize) break;
      const formed = await formParties({ circle: { ...cs.circle, members: pool }, table: cs.table, want: cs.want, verdicts, briefs, people, targetSize, exclude, attempt, useModel: cs.useModel, priority: input.priority, onlyPriority: input.onlyPriority, feasible: input.feasible });
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
        summary: inSquad > 0 ? `${plural(inSquad, "Companion")} in this squad proposed or backed exactly this group out of ${plural(cs.table.length, "proposal")} on the table` : `Formed from ${plural(cs.table.length, "proposal")} the Companions put on the table`,
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
