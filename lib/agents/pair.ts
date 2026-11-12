import { z } from "zod";
import type { Bridge, Fact, PairMessage, Party, ShareableLine } from "@/contracts";
import { pairKey } from "@/lib/graph";
import { callModel, type ModelSource } from "@/model/client";
import { publish } from "@/lib/server/bus";
import { factById, nextId, nowIso, profile, store } from "@/lib/server/store";
import { trace } from "@/lib/server/trace";
import { briefFor, paceFromEnv } from "./table";

/**
 * Pair talk. For each pair, the two agents trade approved lines and look
 * at their Bridge. The model only picks ids; code renders every sentence
 * from approved facts, so each claim maps to a fact its subject approved.
 */

export interface PairSide {
  id: string;
  firstName: string;
  lines: ShareableLine[]; // approved only
  facts: Fact[]; // the approved facts behind those lines
}

export interface PairResult {
  key: string;
  a: string;
  b: string;
  shared: PairMessage;
  openers: Record<string, PairMessage>; // fromId -> opener to the other
  bridge: Bridge | null;
  source: ModelSource;
}

const PairOut = z.object({
  exchangeLineIds: z.array(z.string()).max(4),
  sharedFactIds: z.array(z.string()).max(2),
  bridgeId: z.string().nullable(),
  askForA: z.string(), // a fact id of B that A should ask about
  askForB: z.string(), // a fact id of A that B should ask about
});
type PairOut = z.infer<typeof PairOut>;

export function sideFor(userId: string): PairSide {
  const brief = briefFor(userId);
  const lines = brief.shareable.filter((l) => l.approved);
  const facts = [...new Set(lines.flatMap((l) => l.factIds))]
    .map((id) => factById(id))
    .filter((f): f is Fact => !!f && f.approved && f.ownerId === userId);
  return { id: userId, firstName: profile(userId).firstName, lines, facts };
}

/** Bridges both people consented to show. */
export function consentedBridges(party: Party, a: string, b: string): Bridge[] {
  const s = store();
  const consent = (id: string) => s.queue.some((q) => q.userId === id && q.consentBridges && q.status !== "left");
  if (!consent(a) || !consent(b)) return [];
  const [x, y] = a < b ? [a, b] : [b, a];
  return party.bridges.filter((br) => br.a === x && br.b === y);
}

/** Deterministic pair agent (mock and fallback). */
export function mockPair(A: PairSide, B: PairSide, bridges: Bridge[]): PairOut {
  const aTags = new Map(A.facts.map((f) => [f.tag, f]));
  const sharedTag = B.facts.map((f) => f.tag).filter((t) => aTags.has(t) && t !== "open").sort()[0];
  const aShared = sharedTag ? aTags.get(sharedTag)! : null;
  const bShared = sharedTag ? B.facts.find((f) => f.tag === sharedTag)! : null;
  const profileFact = (side: PairSide) => side.facts.find((f) => f.source === "profile") ?? side.facts[0];
  const askForA = (bShared ?? profileFact(B))?.id ?? "";
  const askForB = (aShared ?? profileFact(A))?.id ?? "";
  const lineFor = (side: PairSide, fact: Fact | null | undefined) => (fact ? side.lines.find((l) => l.factIds.includes(fact.id))?.id : undefined) ?? side.lines[0]?.id;
  return {
    exchangeLineIds: [lineFor(A, aShared ?? profileFact(A)), lineFor(B, bShared ?? profileFact(B))].filter((x): x is string => !!x),
    sharedFactIds: aShared && bShared ? [aShared.id, bShared.id] : [],
    bridgeId: bridges[0]?.id ?? null,
    askForA,
    askForB,
  };
}

const SYSTEM = `Two people's agents compare notes. You see only lines each person approved, and how they're connected.
Pick by id only. Return JSON: {"exchangeLineIds":[one line id from each person],"sharedFactIds":[a fact id of A and a fact id of B with the same tag, or empty],"bridgeId":"id or null","askForA":"a fact id of B that A could ask about","askForB":"a fact id of A that B could ask about"}`;

/** Keep only ids that belong to the right person and were approved. */
function sanitize(out: PairOut, A: PairSide, B: PairSide, bridges: Bridge[], fallback: PairOut): PairOut {
  const aFact = new Set(A.facts.map((f) => f.id));
  const bFact = new Set(B.facts.map((f) => f.id));
  const lineIds = new Set([...A.lines, ...B.lines].map((l) => l.id));
  const exchange = out.exchangeLineIds.filter((id) => lineIds.has(id));
  const [sa, sb] = out.sharedFactIds;
  const sharedOk =
    out.sharedFactIds.length === 2 && aFact.has(sa!) && bFact.has(sb!) && A.facts.find((f) => f.id === sa)!.tag === B.facts.find((f) => f.id === sb)!.tag;
  return {
    exchangeLineIds: exchange.length ? exchange : fallback.exchangeLineIds,
    sharedFactIds: sharedOk ? out.sharedFactIds : out.sharedFactIds.length === 0 ? [] : fallback.sharedFactIds,
    bridgeId: out.bridgeId && bridges.some((b) => b.id === out.bridgeId) ? out.bridgeId : fallback.bridgeId,
    askForA: bFact.has(out.askForA) ? out.askForA : fallback.askForA,
    askForB: aFact.has(out.askForB) ? out.askForB : fallback.askForB,
  };
}

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export function bridgeText(b: Bridge): string {
  return b.kind === "mutual_friend" ? `You both know ${b.viaName}.` : `You're both in ${b.viaName}.`;
}

export function openerText(target: { firstName: string }, fact: Fact): string {
  return `${target.firstName}, ${lowerFirst(fact.ask)}`;
}

async function onePair(party: Party, a: string, b: string, pace: number): Promise<PairResult> {
  const A = sideFor(a);
  const B = sideFor(b);
  const bridges = consentedBridges(party, a, b);
  const key = pairKey(a, b);
  const fallback = mockPair(A, B, bridges);
  const r = await callModel({
    role: "spark",
    task: "pair",
    system: SYSTEM,
    user: JSON.stringify({
      A: { name: A.firstName, lines: A.lines.map((l) => ({ id: l.id, text: l.text })), facts: A.facts.map((f) => ({ id: f.id, tag: f.tag, text: f.text })) },
      B: { name: B.firstName, lines: B.lines.map((l) => ({ id: l.id, text: l.text })), facts: B.facts.map((f) => ({ id: f.id, tag: f.tag, text: f.text })) },
      bridges: bridges.map((br) => ({ id: br.id, kind: br.kind, via: br.viaName })),
    }),
    schema: PairOut,
    mock: () => fallback,
    fallback: () => fallback,
  });
  const out = sanitize(r.value, A, B, bridges, fallback);

  const s = store();
  const post = (m: Omit<PairMessage, "id" | "partyId" | "pairKey" | "at">) => {
    const msg: PairMessage = { id: nextId("pm"), partyId: party.id, pairKey: key, at: nowIso(), ...m };
    s.pairs.push(msg);
    publish("pair.message", msg, [a, b], { stage: true });
    return msg;
  };

  // The exchange: each agent offers one approved line, verbatim.
  for (const lineId of out.exchangeLineIds) {
    const line = [...A.lines, ...B.lines].find((l) => l.id === lineId)!;
    const from = line.ownerId;
    post({ fromId: from, toId: from === a ? b : a, kind: "exchange", text: line.text, sourceIds: line.factIds });
    trace(party.id, "shared", "pair", from, `${profile(a).firstName} + ${profile(b).firstName}`, `${profile(from).firstName}'s agent: ${line.text}`, { meta: { kind: "pair" } });
    if (pace) await new Promise((res) => setTimeout(res, pace / 3));
  }

  // One shared line, from matching approved facts, else the bridge.
  const bridge = bridges.find((br) => br.id === out.bridgeId) ?? null;
  let shared: PairMessage;
  if (out.sharedFactIds.length === 2) {
    const tag = factById(out.sharedFactIds[0]!)!.tag;
    shared = post({ fromId: null, toId: null, kind: "shared", text: `You both listed ${tag}.`, sourceIds: out.sharedFactIds });
  } else if (bridge) {
    shared = post({ fromId: null, toId: null, kind: "shared", text: bridgeText(bridge), sourceIds: [bridge.id] });
  } else {
    shared = post({ fromId: null, toId: null, kind: "shared", text: "You both joined this party.", sourceIds: [party.id] });
  }
  trace(party.id, "shared", "pair", null, `${profile(a).firstName} + ${profile(b).firstName} · in common`, shared.text, { meta: { kind: "pair" } });

  // One opener in each direction, from the other person's approved fact.
  const fa = factById(out.askForA)!; // B's fact, for A to ask
  const fb = factById(out.askForB)!; // A's fact, for B to ask
  const openers: Record<string, PairMessage> = {
    [a]: post({ fromId: a, toId: b, kind: "opener", text: openerText(B, fa), sourceIds: [fa.id] }),
    [b]: post({ fromId: b, toId: a, kind: "opener", text: openerText(A, fb), sourceIds: [fb.id] }),
  };
  trace(party.id, "private", "pair", null, `${profile(a).firstName} + ${profile(b).firstName} · openers · ${r.source} ${r.ms}ms`, `${A.firstName} → ${openers[a]!.text}\n${B.firstName} → ${openers[b]!.text}`, { meta: { kind: "pair", source: r.source } });
  return { key, a, b, shared, openers, bridge, source: r.source };
}

export async function runPairTalk(partyId: string, opts: { paceMs?: number } = {}): Promise<PairResult[]> {
  const party = store().parties.get(partyId);
  if (!party) throw new Error("unknown party");
  const pace = opts.paceMs ?? paceFromEnv();
  const ids = party.memberIds;
  const pairs: [string, string][] = [];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) pairs.push([ids[i]!, ids[j]!]);
  const results: PairResult[] = [];
  for (const [a, b] of pairs) results.push(await onePair(party, a, b, pace));
  return results;
}
