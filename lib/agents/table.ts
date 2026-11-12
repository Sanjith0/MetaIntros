import type { Brief, CandidatePlan, Party, TableMessage, Trace, Verdict } from "@/contracts";
import { publish } from "@/lib/server/bus";
import { nextId, nowIso, profile, store } from "@/lib/server/store";
import { trace } from "@/lib/server/trace";
import { laterTurn, round1Turn, type LaterOut, type PublicTableRow, type Round1Out, type TurnContext } from "./agent";
import { feasibleFor, ownerChecks, partyChecks, rankPlans } from "./judge";
import { verifyPublicLine, type NeutralId, type PublicLine } from "./verifier";
import { flag } from "@/lib/flags";
import type { ModelSource } from "@/model/client";
import { modelSettings } from "@/model/settings";

export const MAX_ROUNDS = 3;

export interface TableOptions {
  paceMs?: number;
  /** Test hook: rewrite one agent's raw output before code sees it (to plant a leak, say). */
  override?: (ownerId: string, round: number, out: Round1Out | LaterOut) => Round1Out | LaterOut;
}

export interface TableResult {
  planId: string;
  lockedBy: "signatures" | "fallback";
  signatures: string[];
  rounds: number;
  unavailable: string[];
}

export const paceFromEnv = () => modelSettings().paceMs ?? Number(process.env.PQ_PACE_MS ?? 600);

/**
 * Start every agent's call at once. With MODEL_READINESS on, handle each
 * result the moment it returns (streamed), one at a time so table state stays
 * consistent; with it off, handle them in member order after all return.
 */
async function streamed<T>(briefs: Brief[], start: (b: Brief) => Promise<T>, handle: (b: Brief, r: T) => Promise<void>, abort: () => boolean = () => false) {
  if (!flag("MODEL_READINESS")) {
    const all = await Promise.all(briefs.map(start));
    for (let i = 0; i < briefs.length; i++) await handle(briefs[i]!, all[i]!);
    return;
  }
  let chain: Promise<void> = Promise.resolve();
  const all = Promise.all(
    briefs.map((b) =>
      start(b).then((r) => {
        chain = chain.then(() => (abort() ? undefined : handle(b, r)));
        return chain;
      }),
    ),
  ).then(() => chain);
  // An operator "lock now" stops waiting for slow agents.
  let poll: ReturnType<typeof setInterval> | undefined;
  const aborted = new Promise<void>((res) => {
    poll = setInterval(() => abort() && res(), 100);
  });
  await Promise.race([all, aborted]);
  clearInterval(poll);
}

function logCall(partyId: string, ownerId: string, round: number, turn: { source: ModelSource; ms: number; note?: string }) {
  store().agentCalls.push({ partyId, ownerId, round, source: turn.source, ms: turn.ms, note: turn.note ?? null });
}

const turnLabel = (turn: { source: ModelSource; ms: number; note?: string }) =>
  turn.source === "fallback" ? `fallback (${turn.note ?? "model unavailable"})` : `${turn.source} ${turn.ms}ms`;

/** With MODEL_READINESS on, the stage shows source and latency as chips from meta. */
const agentTitle = (ownerId: string, round: number, turn: { source: ModelSource; ms: number; note?: string }) =>
  `${profile(ownerId).firstName}'s agent · round ${round}${flag("MODEL_READINESS") ? "" : ` · ${turnLabel(turn)}`}`;
const sleep = (ms: number) => (ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve());

/** A pause that ends early if the operator fast-forwards this party. */
export async function pauseFor(ms: number, partyId: string) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (store().operator.fastForward.has(partyId)) return;
    await sleep(Math.min(50, end - Date.now()));
  }
}

export function briefFor(userId: string): Brief {
  const b = store().briefs.get(`brief-${userId}`);
  if (!b) throw new Error(`no brief for ${userId}`);
  return b;
}

function postTable(party: Party, msg: Omit<TableMessage, "id" | "partyId" | "at">, extra: { tone?: Trace["tone"]; meta?: Trace["meta"] } = {}): TableMessage {
  const m: TableMessage = { id: nextId("t"), partyId: party.id, at: nowIso(), ...msg };
  store().table.push(m);
  publish("table.message", m, party.memberIds, { stage: true });
  const who = m.authorId ? `${profile(m.authorId).firstName}'s agent` : "Table";
  const kind = m.kind === "line" ? "line" : m.kind === "unavailable" ? "unavailable" : m.kind === "leading" ? "leading" : undefined;
  trace(party.id, "shared", "table", m.authorId, `${who} · round ${m.round}`, m.text, {
    tone: extra.tone ?? (m.kind === "unavailable" ? "reject" : undefined),
    meta: { round: m.round, planId: m.planId, kind, ...extra.meta },
  });
  return m;
}

function publicRows(partyId: string): PublicTableRow[] {
  return store()
    .table.filter((t) => t.partyId === partyId)
    .map((t) => ({ round: t.round, from: t.authorId ? profile(t.authorId).firstName : "Table", text: t.text }));
}

/** Verify one public line, post what survives, and record any block privately. */
function speak(party: Party, brief: Brief, round: number, line: PublicLine, fallback: NeutralId) {
  const v = verifyPublicLine(line, brief, fallback);
  if (!v.ok) {
    trace(party.id, "private", "table", brief.ownerId, `Verifier blocked ${profile(brief.ownerId).firstName}'s line`, `Blocked "${line.text}" (${v.reason}). Posted a neutral phrase instead.`, { tone: "block", meta: { round } });
    store().blockedLines.push({ partyId: party.id, ownerId: brief.ownerId, round, text: line.text, reason: v.reason });
  }
  postTable(party, { round, authorId: brief.ownerId, kind: "line", text: v.line.text, sourceIds: v.line.sourceIds });
}

export async function runTableTalk(partyId: string, opts: TableOptions = {}): Promise<TableResult | null> {
  const s = store();
  const party = s.parties.get(partyId);
  if (!party) throw new Error("unknown party");
  const s0 = store();
  const pace = () => (s0.operator.fastForward.has(partyId) ? 0 : (opts.paceMs ?? paceFromEnv()));
  const forced = () => s0.operator.forceLock.has(partyId);
  const plans = party.candidatePlanIds.map((id) => s.plans.get(id)!).filter(Boolean) as CandidatePlan[];
  const briefs = party.memberIds.map(briefFor);
  party.status = "talking";

  postTable(party, { round: 0, authorId: null, kind: "system", text: `The table is open: ${plans.length} plans, 5 agents, up to ${MAX_ROUNDS} rounds.`, sourceIds: plans.map((p) => p.id) }, { meta: { kind: "open" } });
  await pauseFor(pace(), partyId);

  // Party-wide safety first: private venues never reach the agents as options.
  const unavailable = new Set<string>();
  for (const p of plans) {
    const checks = partyChecks(partyId, p);
    s.codeChecks.push(...checks);
    if (checks.some((c) => !c.pass)) unavailable.add(p.id);
  }

  /* -------------------------------- round 1 -------------------------------- */
  const ctxFor = (b: Brief, round: number, leadingPlanId: string | null, ownPrefs?: Record<string, number>): TurnContext => ({
    partyId,
    ownerName: profile(b.ownerId).firstName,
    brief: b,
    plans,
    table: publicRows(partyId),
    round,
    unavailable: [...unavailable],
    leadingPlanId,
    ownPrefs,
  });

  const prefs = new Map<string, Record<string, number>>();

  /** The operator locked now: code picks the best feasible plan from what it has. */
  const forcedLock = (round: number): TableResult | null => {
    const totalsNow = new Map<string, number>();
    for (const p of plans) totalsNow.set(p.id, [...prefs.values()].reduce((sum, own) => sum + (own[p.id] ?? 0), 0));
    const pick =
      rankPlans(plans.filter((p) => feasibleFor(partyId, p, briefs) && !unavailable.has(p.id)), totalsNow)[0] ??
      rankPlans(plans.filter((p) => feasibleFor(partyId, p, briefs)), totalsNow)[0];
    if (!pick) {
      party.status = "failed";
      postTable(party, { round, authorId: null, kind: "system", text: "No plan works for everyone tonight.", sourceIds: plans.map((p) => p.id) });
      return null;
    }
    postTable(party, { round, authorId: null, kind: "system", text: "The organiser asked for the plan now.", sourceIds: [pick.id] });
    trace(partyId, "private", "judge", null, "Operator locked now", `Code picked ${pick.title}, the best plan that passes every member's rules, from the preferences so far.`, { tone: "lock", meta: { planId: pick.id } });
    return { planId: pick.id, lockedBy: "fallback", signatures: [], rounds: round, unavailable: [...unavailable] };
  };

  await streamed(briefs, (b) => round1Turn(ctxFor(b, 1, null)), async (b, turn) => {
    logCall(partyId, b.ownerId, 1, turn);
    const out = (opts.override?.(b.ownerId, 1, turn.out) as Round1Out | undefined) ?? turn.out;
    const own: Record<string, number> = {};
    const lines: string[] = [];
    for (const v of out.verdicts) {
      const plan = plans.find((p) => p.id === v.planId);
      if (!plan) continue;
      const checks = ownerChecks(partyId, plan, b);
      s.codeChecks.push(...checks);
      const failing = checks.filter((c) => !c.pass);
      const overridden = v.decision === "accept" && failing.length > 0;
      const decision = overridden ? "reject" : v.decision;
      const reason = overridden ? `Code overrode the model: ${failing.map((c) => c.detail).join(" ")}` : v.privateReason;
      const verdict: Verdict = {
        partyId,
        ownerId: b.ownerId,
        round: 1,
        planId: plan.id,
        decision,
        preference: decision === "reject" ? 1 : v.preference,
        privateReason: reason.slice(0, 240),
        overriddenByCode: overridden,
      };
      s.verdicts.push(verdict);
      publish("agent.verdict", verdict, [b.ownerId], { stage: true });
      own[plan.id] = verdict.preference;
      if (decision === "reject") unavailable.add(plan.id);
      lines.push(`${decision === "reject" ? "✗" : "✓"} ${plan.title} (${verdict.preference}/5): ${verdict.privateReason}`);
    }
    prefs.set(b.ownerId, own);
    const anyReject = s.verdicts.some((v) => v.partyId === partyId && v.ownerId === b.ownerId && v.round === 1 && v.decision === "reject");
    trace(partyId, "private", "table", b.ownerId, agentTitle(b.ownerId, 1, turn), lines.join("\n"), {
      tone: anyReject ? "reject" : "accept",
      meta: { kind: "verdicts", round: 1, source: turn.source, ms: turn.ms, note: turn.note },
    });
    speak(party, b, 1, out.publicLine, "neutral-hello");
    await pauseFor(pace(), partyId);
  }, forced);
  if (forced()) return forcedLock(1);

  // The table learns only that a plan is unavailable. Never why, never who.
  for (const p of plans.filter((x) => unavailable.has(x.id))) {
    publish("plan.unavailable", { partyId, planId: p.id, round: 1 }, party.memberIds, { stage: true });
    postTable(party, { round: 1, authorId: null, kind: "unavailable", text: `${p.title} · unavailable`, sourceIds: [p.id], planId: p.id });
    await pauseFor(pace() / 2, partyId);
  }

  const available = plans.filter((p) => !unavailable.has(p.id));
  const totals = new Map<string, number>();
  for (const p of plans) totals.set(p.id, [...prefs.values()].reduce((sum, own) => sum + (own[p.id] ?? 0), 0));
  trace(partyId, "private", "judge", null, "Code totals preferences", rankPlans(plans, totals).map((p) => `${p.title}: ${totals.get(p.id)}${unavailable.has(p.id) ? " (unavailable)" : ""}`).join("\n"));

  const finish = (planId: string, lockedBy: TableResult["lockedBy"], signatures: string[], rounds: number): TableResult => ({
    planId,
    lockedBy,
    signatures,
    rounds,
    unavailable: [...unavailable],
  });

  if (available.length === 0) {
    const feasible = rankPlans(plans.filter((p) => feasibleFor(partyId, p, briefs)), totals)[0];
    if (!feasible) {
      postTable(party, { round: 1, authorId: null, kind: "system", text: "No plan works for everyone tonight.", sourceIds: plans.map((p) => p.id) });
      party.status = "failed";
      return null;
    }
    return finish(feasible.id, "fallback", [], 1);
  }

  /* ------------------------------ rounds 2 and 3 ------------------------------ */
  let leading = rankPlans(available, totals)[0]!;
  let signatures: string[] = [];
  for (let round = 2; round <= MAX_ROUNDS; round++) {
    if (forced()) return forcedLock(round);
    postTable(party, { round, authorId: null, kind: "leading", text: `Leading: ${leading.title}`, sourceIds: [leading.id], planId: leading.id });
    await pauseFor(pace(), partyId);
    signatures = [];
    const lead = leading;
    await streamed(briefs, (b) => laterTurn(ctxFor(b, round, lead.id, prefs.get(b.ownerId))), async (b, turn) => {
      logCall(partyId, b.ownerId, round, turn);
      const raw = (opts.override?.(b.ownerId, round, turn.out) as LaterOut | undefined) ?? turn.out;
      let decision = raw.decision;
      let planId = raw.planId;
      // Code normalises: you can only sign or concede on the leading plan, and only if it passes your rules.
      if ((decision === "sign" || decision === "concede") && planId !== leading.id) decision = "hold";
      const failing = ownerChecks(partyId, leading, b).filter((c) => !c.pass);
      if ((decision === "sign" || decision === "concede") && failing.length) decision = "hold";
      if (!plans.some((p) => p.id === planId)) planId = leading.id;
      const verdict: Verdict = {
        partyId,
        ownerId: b.ownerId,
        round,
        planId,
        decision,
        preference: prefs.get(b.ownerId)?.[planId] ?? 3,
        privateReason: raw.privateReason.slice(0, 240),
        overriddenByCode: decision !== raw.decision,
      };
      s.verdicts.push(verdict);
      publish("agent.verdict", verdict, [b.ownerId], { stage: true });
      if (decision !== "hold") signatures.push(b.ownerId);
      trace(partyId, "private", "table", b.ownerId, agentTitle(b.ownerId, round, turn), `${decision.toUpperCase()} ${plans.find((p) => p.id === planId)?.title ?? planId}: ${verdict.privateReason}`, {
        tone: decision === "hold" ? "hold" : "sign",
        meta: { kind: "verdicts", round, decision, planId, source: turn.source, ms: turn.ms, note: turn.note },
      });
      speak(party, b, round, raw.publicLine, decision === "hold" ? "neutral-thinking" : "neutral-in");
      await pauseFor(pace(), partyId);
    }, forced);
    if (forced()) return forcedLock(round);
    postTable(
      party,
      { round, authorId: null, kind: "system", text: `${signatures.length} of 5 signed ${leading.title}.`, sourceIds: [leading.id] },
      { tone: signatures.length === party.memberIds.length ? "sign" : "neutral", meta: { kind: "tally", planId: leading.id } },
    );
    await pauseFor(pace(), partyId);
    if (signatures.length === party.memberIds.length) return finish(leading.id, "signatures", signatures, round);
    leading = rankPlans(available, totals)[0]!;
  }

  // Round 3 ended without five signatures: code picks the best feasible plan.
  const fallback = rankPlans(plans.filter((p) => feasibleFor(partyId, p, briefs) && !unavailable.has(p.id)), totals)[0] ?? rankPlans(plans.filter((p) => feasibleFor(partyId, p, briefs)), totals)[0];
  if (!fallback) {
    party.status = "failed";
    postTable(party, { round: MAX_ROUNDS, authorId: null, kind: "system", text: "No plan works for everyone tonight.", sourceIds: plans.map((p) => p.id) });
    return null;
  }
  trace(partyId, "private", "judge", null, "Fallback", `No five signatures after round ${MAX_ROUNDS}. Code picked ${fallback.title}, the best feasible plan by total preference.`, { tone: "lock", meta: { planId: fallback.id } });
  return finish(fallback.id, "fallback", signatures, MAX_ROUNDS);
}
