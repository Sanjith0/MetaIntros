/**
 * Queue matchmaking engine (pure). Like ranked queues, search starts strict and widens
 * with wait time — but only *compatibility* and *distance* widen. Safety rules
 * (lib/match/safety.ts) are hard filters at every level.
 */
import type { Person } from "@/lib/profile/load";
import { bucketDistanceKm } from "./buckets";
import { groupCohesion, type CohesionResult } from "./cohesion";
import { makePairScorer } from "./compat";
import { pairAllowed, validateParty } from "./safety";

export type FillMode = "simulated" | "mixed" | "live";
/**
 * Which queue an entry is in. "events" = existing Facebook events (eventId set = queued from that
 * event, null = "any event"); "hangout" = Queue Up plans a brand-new hangout. Modes never mix.
 */
export type QueueMode = "events" | "hangout";

export interface QueueItem {
  entryId: string;
  userId: string;
  targetSize: number;
  bucketId: string;
  /** null = "any event this weekend" (always null in hangout mode) */
  eventId: string | null;
  /** defaults to "events" */
  mode?: QueueMode;
  joinedAt: number; // ms epoch
  isSimulated: boolean;
}

export interface SearchLevel {
  afterMs: number;
  radiusKm: number;
  minCohesion: number;
  minPairwise: number;
}

/** Strict → relaxed. The last level is the cap; nothing relaxes beyond it. */
export const LEVELS: SearchLevel[] = [
  { afterMs: 0, radiusKm: 0, minCohesion: 0.68, minPairwise: 0.45 },
  { afterMs: 8_000, radiusKm: 0, minCohesion: 0.6, minPairwise: 0.35 },
  { afterMs: 16_000, radiusKm: 6, minCohesion: 0.5, minPairwise: 0.25 },
  { afterMs: 30_000, radiusKm: 15, minCohesion: 0.4, minPairwise: 0.15 },
];
/**
 * Extra level used for live demos (real strangers with unrelated interests must still be
 * able to squad up). Only compatibility drops; safety is untouched.
 */
export const LIVE_FLOOR_LEVEL: SearchLevel = { afterMs: 40_000, radiusKm: 40, minCohesion: 0, minPairwise: 0 };

export interface EngineOptions {
  now: number;
  fillMode: FillMode;
  /** Mixed mode: simulated users may only fill a real user's party after this long. */
  mixedFillDelayMs?: number;
  /** Enable LIVE_FLOOR_LEVEL (defaults on for live/mixed). */
  liveFloor?: boolean;
  candidatesPerProposal?: number;
}

export interface Candidate {
  entryIds: string[];
  userIds: string[];
  /** specific event any member queued for (null = "anything") */
  eventId: string | null;
  cohesion: CohesionResult;
}

export interface Proposal {
  anchorEntryId: string;
  targetSize: number;
  mode: QueueMode;
  eventId: string | null;
  bucketId: string;
  level: number;
  /** best first; all pass safety + the level threshold */
  candidates: Candidate[];
}

export function levelFor(waitMs: number, opts: Pick<EngineOptions, "fillMode" | "liveFloor">): { level: SearchLevel; index: number } {
  const levels = levelsFor(opts);
  let idx = 0;
  for (let i = 0; i < levels.length; i++) if (waitMs >= levels[i].afterMs) idx = i;
  return { level: levels[idx], index: idx };
}

function levelsFor(opts: Pick<EngineOptions, "fillMode" | "liveFloor">) {
  const floor = opts.liveFloor ?? opts.fillMode !== "simulated";
  return floor ? [...LEVELS, LIVE_FLOOR_LEVEL] : LEVELS;
}

type Scorer = ReturnType<typeof makePairScorer>;

const modeOf = (q: Pick<QueueItem, "mode">): QueueMode => q.mode ?? "events";

/**
 * Hard queue separation: hangout ↔ hangout only. Within the existing-events queue, someone who
 * queued from a specific event can be joined by "any event" queuers (who then go to that event),
 * but two different specific events never mix.
 */
export function queuesCompatible(a: Pick<QueueItem, "mode" | "eventId">, b: Pick<QueueItem, "mode" | "eventId">) {
  if (modeOf(a) !== modeOf(b)) return false;
  return a.eventId === null || b.eventId === null || a.eventId === b.eventId;
}

/** Greedy group growth from a seed set: add whoever maximizes the group's weakest link. */
function growGroup(seed: QueueItem[], pool: QueueItem[], size: number, people: Map<string, Person>, score: Scorer): QueueItem[] | null {
  const group = [...seed];
  const mode = modeOf(group[0]);
  let event = group.find((g) => g.eventId)?.eventId ?? null;
  const remaining = pool.filter((p) => !group.some((g) => g.entryId === p.entryId));
  while (group.length < size) {
    let best: { item: QueueItem; min: number; avg: number } | null = null;
    for (const c of remaining) {
      if (group.some((g) => g.userId === c.userId)) continue;
      if (!queuesCompatible({ mode, eventId: event }, c)) continue;
      const pc = people.get(c.userId)!;
      if (!group.every((g) => pairAllowed(people.get(g.userId)!, pc))) continue;
      let min = 1, sum = 0;
      for (const g of group) {
        const s = score(people.get(g.userId)!, pc).score;
        min = Math.min(min, s);
        sum += s;
      }
      const avg = sum / group.length;
      if (!best || min > best.min + 1e-9 || (Math.abs(min - best.min) <= 1e-9 && (avg > best.avg + 1e-9 || (Math.abs(avg - best.avg) <= 1e-9 && c.joinedAt < best.item.joinedAt)))) {
        best = { item: c, min, avg };
      }
    }
    if (!best) return null;
    group.push(best.item);
    event = event ?? best.item.eventId;
    remaining.splice(remaining.indexOf(best.item), 1);
  }
  return group;
}

/**
 * Everyone in the queue who could be matched with this anchor at its current search level:
 * same party size, compatible queue, within the radius, allowed by the safety rules, and
 * respecting the fill mode. Excludes the anchor.
 */
export function eligiblePool(
  anchor: QueueItem,
  pool: QueueItem[],
  people: Map<string, Person>,
  landmarks: Map<string, { id: string; lat: number; lng: number }>,
  opts: EngineOptions,
): { items: QueueItem[]; level: SearchLevel; index: number } | null {
  const { level, index } = levelFor(opts.now - anchor.joinedAt, opts);
  const anchorP = people.get(anchor.userId);
  if (!anchorP) return null;
  const mixedDelay = opts.mixedFillDelayMs ?? 12_000;
  const items = pool.filter((c) => {
    if (c.entryId === anchor.entryId || c.userId === anchor.userId) return false;
    if (c.targetSize !== anchor.targetSize) return false; // party size is a hard "game mode"
    if (!queuesCompatible(anchor, c)) return false;
    if (bucketDistanceKm(anchor.bucketId, c.bucketId, landmarks) > level.radiusKm) return false;
    const cp = people.get(c.userId);
    if (!cp || !pairAllowed(anchorP, cp)) return false;
    if (c.isSimulated) {
      if (opts.fillMode === "live") return false;
      if (opts.fillMode === "mixed" && !anchor.isSimulated && opts.now - anchor.joinedAt < mixedDelay) return false;
    }
    return true;
  });
  return { items, level, index };
}

/** Best safe candidate groups for one anchor at its current search level. */
export function findProposal(
  anchor: QueueItem,
  pool: QueueItem[],
  people: Map<string, Person>,
  landmarks: Map<string, { id: string; lat: number; lng: number }>,
  opts: EngineOptions,
  score: Scorer,
): Proposal | null {
  const found = eligiblePool(anchor, pool, people, landmarks, opts);
  if (!found) return null;
  const { level, index, items: eligible } = found;
  const anchorP = people.get(anchor.userId)!;
  if (eligible.length < anchor.targetSize - 1) return null;

  // Seeds: anchor alone, plus anchor + each of its top-3 partners → diverse candidates for the agent.
  const ranked = [...eligible].sort((a, b) => score(anchorP, people.get(b.userId)!).score - score(anchorP, people.get(a.userId)!).score);
  const seeds: QueueItem[][] = [[anchor], ...ranked.slice(0, 3).map((r) => [anchor, r])];
  const seen = new Set<string>();
  const candidates: Candidate[] = [];
  for (const s of seeds) {
    const g = growGroup(s, eligible, anchor.targetSize, people, score);
    if (!g) continue;
    const key = g.map((x) => x.entryId).sort().join(",");
    if (seen.has(key)) continue;
    seen.add(key);
    const members = g.map((x) => people.get(x.userId)!);
    if (!validateParty(members).ok) continue; // belt and braces
    const cohesion = groupCohesion(members, score);
    if (cohesion.score < level.minCohesion || cohesion.minPairwise < level.minPairwise) continue;
    candidates.push({
      entryIds: g.map((x) => x.entryId),
      userIds: g.map((x) => x.userId),
      eventId: g.find((x) => x.eventId)?.eventId ?? null,
      cohesion,
    });
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.cohesion.score - a.cohesion.score);
  return {
    anchorEntryId: anchor.entryId,
    targetSize: anchor.targetSize,
    mode: modeOf(anchor),
    eventId: anchor.eventId ?? candidates[0].eventId,
    bucketId: anchor.bucketId,
    level: index,
    candidates: candidates.slice(0, opts.candidatesPerProposal ?? 3),
  };
}

/**
 * One matchmaking tick. Anchors are processed oldest-first (real users before simulated
 * fillers at equal wait), and each formed party's members are removed before the next anchor,
 * so nobody can land in two parties. `choose` lets an agent pick among candidates; whatever it
 * returns is re-validated here.
 */
export function runTick(
  waiting: QueueItem[],
  people: Map<string, Person>,
  landmarks: Map<string, { id: string; lat: number; lng: number }>,
  opts: EngineOptions,
  choose: (p: Proposal) => Candidate = (p) => p.candidates[0],
  score: Scorer = makePairScorer(),
): { proposal: Proposal; chosen: Candidate }[] {
  const pool = [...waiting].sort((a, b) => a.joinedAt - b.joinedAt || Number(a.isSimulated) - Number(b.isSimulated) || a.entryId.localeCompare(b.entryId));
  const taken = new Set<string>();
  const out: { proposal: Proposal; chosen: Candidate }[] = [];
  for (const anchor of pool) {
    if (taken.has(anchor.entryId)) continue;
    // In live/mixed modes simulated users never anchor; they only fill.
    if (anchor.isSimulated && opts.fillMode !== "simulated") continue;
    const avail = pool.filter((p) => !taken.has(p.entryId));
    const proposal = findProposal(anchor, avail, people, landmarks, opts, score);
    if (!proposal) continue;
    let chosen = choose(proposal);
    const valid =
      chosen &&
      proposal.candidates.some((c) => c.entryIds.join() === chosen.entryIds.join()) &&
      chosen.entryIds.every((id) => !taken.has(id)) &&
      validateParty(chosen.userIds.map((u) => people.get(u)!)).ok;
    if (!valid) chosen = proposal.candidates[0];
    chosen.entryIds.forEach((id) => taken.add(id));
    out.push({ proposal, chosen });
  }
  return out;
}

/** "Players found: k/N" for a waiting user — best safe group currently reachable at their level. */
export function playersFound(
  anchor: QueueItem,
  waiting: QueueItem[],
  people: Map<string, Person>,
  landmarks: Map<string, { id: string; lat: number; lng: number }>,
  opts: EngineOptions,
  score: Scorer = makePairScorer(),
): { found: number; userIds: string[] } {
  const anchorP = people.get(anchor.userId);
  if (!anchorP) return { found: 1, userIds: [anchor.userId] };
  const { level } = levelFor(opts.now - anchor.joinedAt, opts);
  const radius = Math.max(level.radiusKm, 6);
  const eligible = waiting.filter((c) => {
    if (c.userId === anchor.userId || c.targetSize !== anchor.targetSize || !queuesCompatible(anchor, c)) return false;
    if (bucketDistanceKm(anchor.bucketId, c.bucketId, landmarks) > radius) return false;
    if (c.isSimulated && opts.fillMode === "live") return false;
    const cp = people.get(c.userId);
    return Boolean(cp && pairAllowed(anchorP, cp));
  });
  const g = growGroup([anchor], eligible, Math.min(anchor.targetSize, eligible.length + 1), people, score) ?? [anchor];
  return { found: g.length, userIds: g.map((x) => x.userId) };
}

/** Async variant of runTick: `choose` may be an LLM agent. Validation is identical. */
export async function runTickAsync(
  waiting: QueueItem[],
  people: Map<string, Person>,
  landmarks: Map<string, { id: string; lat: number; lng: number }>,
  opts: EngineOptions,
  choose: (p: Proposal) => Promise<Candidate | null>,
  commit: (p: Proposal, c: Candidate) => Promise<boolean>,
  score: Scorer = makePairScorer(),
): Promise<number> {
  const pool = [...waiting].sort((a, b) => a.joinedAt - b.joinedAt || Number(a.isSimulated) - Number(b.isSimulated) || a.entryId.localeCompare(b.entryId));
  const taken = new Set<string>();
  let formed = 0;
  for (const anchor of pool) {
    if (taken.has(anchor.entryId)) continue;
    if (anchor.isSimulated && opts.fillMode !== "simulated") continue;
    const proposal = findProposal(anchor, pool.filter((p) => !taken.has(p.entryId)), people, landmarks, opts, score);
    if (!proposal) continue;
    let chosen = await choose(proposal).catch(() => null);
    const valid =
      chosen &&
      proposal.candidates.some((c) => c.entryIds.join() === chosen!.entryIds.join()) &&
      validateParty(chosen.userIds.map((u) => people.get(u)!)).ok;
    if (!valid) chosen = proposal.candidates[0];
    if (await commit(proposal, chosen!)) {
      chosen!.entryIds.forEach((id) => taken.add(id));
      formed++;
    }
  }
  return formed;
}

/** The most people one run of the Companion engine considers. */
export const MAX_ROOM = 30;

/**
 * Companion-engine tick. For each anchor (same order and rules as runTickAsync) the "room" is the
 * anchor plus everyone who could be matched with them; `match` (the Companion engine) returns the
 * squads the Companions and the Orchestrator settled on. Code re-checks every squad before it is
 * committed: exact size, entries still free, one event at most, and the hard safety rules.
 */
export async function runRoomsAsync(
  waiting: QueueItem[],
  people: Map<string, Person>,
  landmarks: Map<string, { id: string; lat: number; lng: number }>,
  opts: EngineOptions,
  match: (anchor: QueueItem, room: QueueItem[], level: number) => Promise<Candidate[]>,
  commit: (p: Proposal, c: Candidate) => Promise<boolean>,
): Promise<number> {
  const pool = [...waiting].sort((a, b) => a.joinedAt - b.joinedAt || Number(a.isSimulated) - Number(b.isSimulated) || a.entryId.localeCompare(b.entryId));
  const taken = new Set<string>();
  let formed = 0;
  for (const anchor of pool) {
    if (taken.has(anchor.entryId)) continue;
    if (anchor.isSimulated && opts.fillMode !== "simulated") continue;
    const found = eligiblePool(anchor, pool.filter((p) => !taken.has(p.entryId)), people, landmarks, opts);
    if (!found) continue;
    // Everyone in a room must be able to go to the same event: the first specific event wins.
    let eventId = anchor.eventId;
    const items: QueueItem[] = [];
    for (const it of found.items) {
      if (it.eventId && eventId && it.eventId !== eventId) continue;
      eventId = eventId ?? it.eventId;
      items.push(it);
    }
    if (items.length < anchor.targetSize - 1) continue;
    const room = [anchor, ...items.slice(0, MAX_ROOM - 1)];
    const inRoom = new Map(room.map((r) => [r.entryId, r]));
    const candidates = await match(anchor, room, found.index).catch(() => [] as Candidate[]);
    let any = false;
    for (const c of candidates) {
      const ok =
        c.entryIds.length === anchor.targetSize &&
        new Set(c.entryIds).size === c.entryIds.length &&
        c.entryIds.every((id) => inRoom.has(id) && !taken.has(id)) &&
        c.userIds.join() === c.entryIds.map((id) => inRoom.get(id)!.userId).join() &&
        validateParty(c.userIds.map((u) => people.get(u)!)).ok;
      if (!ok) continue;
      const proposal: Proposal = { anchorEntryId: anchor.entryId, targetSize: anchor.targetSize, mode: modeOf(anchor), eventId, bucketId: anchor.bucketId, level: found.index, candidates: [c] };
      if (await commit(proposal, { ...c, eventId })) {
        c.entryIds.forEach((id) => taken.add(id));
        formed++;
        any = true;
      }
    }
    // A room is used once per tick: leftover fillers must not form another squad before they are withdrawn.
    if (any) room.forEach((r) => taken.add(r.entryId));
  }
  return formed;
}
