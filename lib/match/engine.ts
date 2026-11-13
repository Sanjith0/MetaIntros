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
 * event, null = "any event"); "hangout" = Link plans a brand-new hangout. Modes never mix.
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
  /** queuing together: every item with this id lands in the same squad, or none of them does */
  groupId?: string | null;
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
  /**
   * Whether simulated users may anchor (start) a squad. Default: only in "simulated" fill mode (engine
   * simulations). The server passes false so fillers only ever complete squads around real people.
   */
  simAnchors?: boolean;
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

/** People who queued together chose each other: their pair counts as a strong match. Safety still applies. */
export const GROUP_PAIR_SCORE = 0.9;

/** Wrap a scorer so pairs from the same queue-together group score at least GROUP_PAIR_SCORE. */
function groupAwareScorer(score: Scorer, items: QueueItem[]): Scorer {
  const groupOf = new Map<string, string>();
  for (const it of items) if (it.groupId) groupOf.set(it.userId, it.groupId);
  if (!groupOf.size) return score;
  return ((a: Person, b: Person) => {
    const r = score(a, b);
    const ga = groupOf.get(a.id);
    return ga && ga === groupOf.get(b.id) ? { ...r, score: Math.max(r.score, GROUP_PAIR_SCORE) } : r;
  }) as Scorer;
}

/** The unit an item moves with: its whole queue-together group (as present in `pool`), or just itself. */
function unitOf(item: QueueItem, pool: QueueItem[]): QueueItem[] {
  return item.groupId ? pool.filter((p) => p.groupId === item.groupId) : [item];
}

/**
 * Greedy group growth from a seed set: add whichever unit (one person, or a whole queue-together group)
 * maximizes the group's weakest link. Groups are added whole or not at all — never split.
 */
function growGroup(seed: QueueItem[], pool: QueueItem[], size: number, people: Map<string, Person>, score: Scorer): QueueItem[] | null {
  const group = [...seed];
  const mode = modeOf(group[0]);
  let event = group.find((g) => g.eventId)?.eventId ?? null;
  let remaining = pool.filter((p) => !group.some((g) => g.entryId === p.entryId));
  while (group.length < size) {
    let best: { unit: QueueItem[]; min: number; avg: number; joinedAt: number } | null = null;
    const seenGroups = new Set<string>();
    for (const c of remaining) {
      if (c.groupId) {
        if (seenGroups.has(c.groupId)) continue;
        seenGroups.add(c.groupId);
      }
      const unit = unitOf(c, remaining);
      if (group.length + unit.length > size) continue;
      if (unit.some((u) => group.some((g) => g.userId === u.userId))) continue;
      const unitEvent = unit.find((u) => u.eventId)?.eventId ?? null;
      if (!unit.every((u) => queuesCompatible({ mode, eventId: event }, u)) || (event && unitEvent && event !== unitEvent)) continue;
      if (!unit.every((u) => group.every((g) => pairAllowed(people.get(g.userId)!, people.get(u.userId)!)))) continue;
      let min = 1, sum = 0, n = 0;
      for (const u of unit)
        for (const g of group) {
          const sc = score(people.get(g.userId)!, people.get(u.userId)!).score;
          min = Math.min(min, sc);
          sum += sc;
          n++;
        }
      const avg = sum / n;
      const joinedAt = Math.min(...unit.map((u) => u.joinedAt));
      if (!best || min > best.min + 1e-9 || (Math.abs(min - best.min) <= 1e-9 && (avg > best.avg + 1e-9 || (Math.abs(avg - best.avg) <= 1e-9 && joinedAt < best.joinedAt)))) {
        best = { unit, min, avg, joinedAt };
      }
    }
    if (!best) return null;
    const chosen = best.unit;
    group.push(...chosen);
    event = event ?? chosen.find((u) => u.eventId)?.eventId ?? null;
    remaining = remaining.filter((r) => !chosen.includes(r));
  }
  return group;
}

/**
 * Who could join the anchor's squad: same size and queue, close enough, safe with every member of the
 * anchor's own group. A queue-together group is only eligible if all of its members are.
 */
function eligibleFor(anchorUnit: QueueItem[], pool: QueueItem[], people: Map<string, Person>, landmarks: Map<string, { id: string; lat: number; lng: number }>, radiusKm: number, accept: (c: QueueItem) => boolean): QueueItem[] {
  const anchor = anchorUnit[0];
  const inUnit = new Set(anchorUnit.map((u) => u.entryId));
  const unitUsers = new Set(anchorUnit.map((u) => u.userId));
  const base = pool.filter((c) => {
    if (inUnit.has(c.entryId) || unitUsers.has(c.userId)) return false;
    if (c.targetSize !== anchor.targetSize) return false; // party size is a hard "game mode"
    if (!queuesCompatible(anchor, c)) return false;
    if (bucketDistanceKm(anchor.bucketId, c.bucketId, landmarks) > radiusKm) return false;
    const cp = people.get(c.userId);
    if (!cp || !anchorUnit.every((u) => pairAllowed(people.get(u.userId)!, cp))) return false;
    return accept(c);
  });
  const ok = new Set(base.map((b) => b.entryId));
  return base.filter((c) => !c.groupId || pool.filter((p) => p.groupId === c.groupId).every((m) => ok.has(m.entryId)));
}

/**
 * Everyone who could be matched with this anchor at its current search level: the anchor's own
 * queue-together group (`unit`, anchor first) and everyone else who passes the same filters as
 * findProposal (`items`, whole groups only). Null if the anchor's group can't fit a squad.
 */
export function eligiblePool(
  anchor: QueueItem,
  pool: QueueItem[],
  people: Map<string, Person>,
  landmarks: Map<string, { id: string; lat: number; lng: number }>,
  opts: EngineOptions,
): { unit: QueueItem[]; items: QueueItem[]; level: SearchLevel; index: number } | null {
  const { level, index } = levelFor(opts.now - anchor.joinedAt, opts);
  if (!people.get(anchor.userId)) return null;
  const mixedDelay = opts.mixedFillDelayMs ?? 12_000;
  // The anchor brings its whole queue-together group (if any); strangers fill the remaining spots.
  const unit = [anchor, ...unitOf(anchor, pool).filter((u) => u.entryId !== anchor.entryId)];
  if (unit.length > anchor.targetSize || unit.some((u) => !people.get(u.userId))) return null;
  const items = eligibleFor(unit, pool, people, landmarks, level.radiusKm, (c) => {
    if (c.isSimulated) {
      if (opts.fillMode === "live") return false;
      if (opts.fillMode === "mixed" && !anchor.isSimulated && opts.now - anchor.joinedAt < mixedDelay) return false;
    }
    return true;
  });
  return { unit, items, level, index };
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
  const { level, index, unit: anchorUnit, items: eligible } = found;
  const anchorP = people.get(anchor.userId)!;
  if (eligible.length < anchor.targetSize - anchorUnit.length) return null;
  const sc = groupAwareScorer(score, [...anchorUnit, ...eligible]);

  // Seeds: the anchor's unit alone, plus with each of its top-3 partners → diverse candidates for the agent.
  const ranked = [...eligible].sort((a, b) => sc(anchorP, people.get(b.userId)!).score - sc(anchorP, people.get(a.userId)!).score);
  const seeds: QueueItem[][] = [anchorUnit];
  for (const r of ranked.slice(0, 3)) {
    const withR = [...anchorUnit, ...unitOf(r, eligible)];
    if (withR.length <= anchor.targetSize) seeds.push(withR);
  }
  const seen = new Set<string>();
  const candidates: Candidate[] = [];
  for (const sd of seeds) {
    const g = growGroup(sd, eligible, anchor.targetSize, people, sc);
    if (!g) continue;
    const key = g.map((x) => x.entryId).sort().join(",");
    if (seen.has(key)) continue;
    seen.add(key);
    const members = g.map((x) => people.get(x.userId)!);
    if (!validateParty(members).ok) continue; // belt and braces
    const cohesion = groupCohesion(members, sc);
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
    if (anchor.isSimulated && !(opts.simAnchors ?? opts.fillMode === "simulated")) continue;
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
  const anchorUnit = [anchor, ...unitOf(anchor, waiting).filter((u) => u.entryId !== anchor.entryId && people.get(u.userId))];
  const eligible = eligibleFor(anchorUnit, waiting, people, landmarks, radius, (c) => !(c.isSimulated && opts.fillMode === "live"));
  const sc = groupAwareScorer(score, [...anchorUnit, ...eligible]);
  const g = growGroup(anchorUnit, eligible, Math.min(anchor.targetSize, eligible.length + anchorUnit.length), people, sc) ?? anchorUnit;
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
    if (anchor.isSimulated && !(opts.simAnchors ?? opts.fillMode === "simulated")) continue;
    const proposal = findProposal(anchor, pool.filter((p) => !taken.has(p.entryId)), people, landmarks, opts, score);
    if (!proposal) continue;
    let chosen = await choose(proposal).catch(() => null);
    const valid =
      chosen &&
      proposal.candidates.some((c) => c.entryIds.join() === chosen!.entryIds.join()) &&
      validateParty(chosen.userIds.map((u) => people.get(u)!)).ok;
    if (!valid) chosen = proposal.candidates[0];
    const ok = await commit(proposal, chosen!);
    // Formed or not, these entries are done for this tick: a failed commit (no event fits, someone
    // left) must not be retried by the next anchor with the same people within the same pass.
    chosen!.entryIds.forEach((id) => taken.add(id));
    if (ok) formed++;
  }
  return formed;
}

/** The most people one run of the Companion engine considers. */
export const MAX_ROOM = 8;

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
    if (anchor.isSimulated && !(opts.simAnchors ?? opts.fillMode === "simulated")) continue;
    const found = eligiblePool(anchor, pool.filter((p) => !taken.has(p.entryId)), people, landmarks, opts);
    if (!found) continue;
    // Everyone in a room must be able to go to the same event (the first specific event wins), and
    // queue-together groups come in whole or not at all, within the room cap.
    let eventId = found.unit.find((u) => u.eventId)?.eventId ?? null;
    const room = [...found.unit];
    const seenGroups = new Set(found.unit.map((u) => u.groupId).filter(Boolean));
    for (const it of found.items) {
      if (it.groupId && seenGroups.has(it.groupId)) continue;
      const unit = unitOf(it, found.items);
      if (it.groupId) seenGroups.add(it.groupId);
      const unitEvent = unit.find((u) => u.eventId)?.eventId ?? null;
      if (unitEvent && eventId && unitEvent !== eventId) continue;
      if (room.length + unit.length > MAX_ROOM) continue;
      eventId = eventId ?? unitEvent;
      room.push(...unit);
    }
    if (room.length < anchor.targetSize) continue;
    const inRoom = new Map(room.map((r) => [r.entryId, r]));
    const candidates = await match(anchor, room, found.index).catch(() => [] as Candidate[]);
    for (const c of candidates) {
      const members = c.entryIds.map((id) => inRoom.get(id));
      const ok =
        c.entryIds.length === anchor.targetSize &&
        new Set(c.entryIds).size === c.entryIds.length &&
        members.every((m) => m && !taken.has(m.entryId)) &&
        c.userIds.join() === members.map((m) => m!.userId).join() &&
        // a queue-together group is never split
        members.every((m) => !m!.groupId || room.filter((r) => r.groupId === m!.groupId).every((r) => c.entryIds.includes(r.entryId))) &&
        validateParty(c.userIds.map((u) => people.get(u)!)).ok;
      if (!ok) continue;
      const proposal: Proposal = { anchorEntryId: anchor.entryId, targetSize: anchor.targetSize, mode: modeOf(anchor), eventId, bucketId: anchor.bucketId, level: found.index, candidates: [c] };
      if (await commit(proposal, { ...c, eventId })) {
        c.entryIds.forEach((id) => taken.add(id));
        formed++;
      }
    }
    // A room runs once per tick, whatever the outcome: leftover fillers must not form another squad
    // before they are withdrawn, and a room that failed must not be re-run by its next anchor in the
    // same pass (each run is ~45 model calls).
    room.forEach((r) => taken.add(r.entryId));
  }
  return formed;
}
