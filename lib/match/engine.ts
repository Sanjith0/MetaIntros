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
  /**
   * Queue with friends: entries sharing a groupId queued together. They are one unit: always in
   * the same squad, never split, and the search only looks for newcomers who fit all of them.
   */
  groupId?: string | null;
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

/** A unit is what the matcher places: one solo queuer, or everyone who queued together. */
type Unit = QueueItem[];

/** Split items into units: entries sharing a groupId form one unit, everyone else is alone. */
export function unitsOf(items: QueueItem[]): Unit[] {
  const groups = new Map<string, Unit>();
  const out: Unit[] = [];
  for (const it of items) {
    if (!it.groupId) {
      out.push([it]);
      continue;
    }
    let u = groups.get(it.groupId);
    if (!u) {
      u = [];
      groups.set(it.groupId, u);
      out.push(u);
    }
    u.push(it);
  }
  return out;
}

/** groupId → member ids, for cohesion (pairs who came together are not judged against each other). */
export function cameTogetherMap(items: QueueItem[]): Map<string, string> {
  return new Map(items.filter((i) => i.groupId).map((i) => [i.userId, i.groupId!]));
}

/** The anchor's unit: the anchor plus anyone it queued with who is still in the pool. */
function unitFor(anchor: QueueItem, pool: QueueItem[]): Unit {
  if (!anchor.groupId) return [anchor];
  const mates = pool.filter((p) => p.groupId === anchor.groupId && p.entryId !== anchor.entryId);
  return [anchor, ...mates];
}

/**
 * Greedy squad growth from a seed: add whichever unit maximizes the squad's weakest link. A unit of
 * friends is added whole or not at all. Pairs inside one unit are never scored (they chose each other).
 */
function growGroup(seed: QueueItem[], pool: Unit[], size: number, people: Map<string, Person>, score: Scorer): QueueItem[] | null {
  const group = [...seed];
  const mode = modeOf(group[0]);
  let event = group.find((g) => g.eventId)?.eventId ?? null;
  const inGroup = (u: Unit) => u.some((c) => group.some((g) => g.entryId === c.entryId || g.userId === c.userId));
  const remaining = pool.filter((u) => !inGroup(u));
  while (group.length < size) {
    let best: { unit: Unit; min: number; avg: number; joinedAt: number } | null = null;
    for (const u of remaining) {
      if (group.length + u.length > size) continue;
      if (inGroup(u)) continue;
      if (!u.every((c) => queuesCompatible({ mode, eventId: event }, c))) continue;
      // two different specific events inside one unit never happen (a unit shares settings), but stay safe
      const unitEvents = new Set(u.map((c) => c.eventId).filter(Boolean));
      if (unitEvents.size > 1 || (event && unitEvents.size && !unitEvents.has(event))) continue;
      let ok = true, min = 1, sum = 0, n = 0;
      for (const c of u) {
        const pc = people.get(c.userId)!;
        for (const g of group) {
          const pg = people.get(g.userId)!;
          if (!pairAllowed(pg, pc)) {
            ok = false;
            break;
          }
          const s = score(pg, pc).score;
          min = Math.min(min, s);
          sum += s;
          n++;
        }
        if (!ok) break;
      }
      if (!ok) continue;
      const avg = n ? sum / n : 0;
      const joinedAt = Math.min(...u.map((c) => c.joinedAt));
      if (!best || min > best.min + 1e-9 || (Math.abs(min - best.min) <= 1e-9 && (avg > best.avg + 1e-9 || (Math.abs(avg - best.avg) <= 1e-9 && joinedAt < best.joinedAt)))) {
        best = { unit: u, min, avg, joinedAt };
      }
    }
    if (!best) return null;
    group.push(...best.unit);
    event = event ?? best.unit.find((c) => c.eventId)?.eventId ?? null;
    remaining.splice(remaining.indexOf(best.unit), 1);
  }
  return group;
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
  const { level, index } = levelFor(opts.now - anchor.joinedAt, opts);
  const anchorP = people.get(anchor.userId);
  if (!anchorP) return null;
  const mixedDelay = opts.mixedFillDelayMs ?? 12_000;

  // Queue with friends: the anchor brings everyone it queued with. They need at least one newcomer.
  const anchorUnit = unitFor(anchor, pool);
  const unitPeople = anchorUnit.map((u) => people.get(u.userId));
  if (unitPeople.some((p) => !p)) return null;
  if (anchorUnit.length >= anchor.targetSize) return null;
  const inAnchorUnit = new Set(anchorUnit.map((u) => u.entryId));
  const anchorUsers = new Set(anchorUnit.map((u) => u.userId));

  const eligibleItem = (c: QueueItem) => {
    if (inAnchorUnit.has(c.entryId) || anchorUsers.has(c.userId)) return false;
    if (c.targetSize !== anchor.targetSize) return false; // party size is a hard "game mode"
    if (!queuesCompatible(anchor, c)) return false;
    if (bucketDistanceKm(anchor.bucketId, c.bucketId, landmarks) > level.radiusKm) return false;
    const cp = people.get(c.userId);
    if (!cp || !unitPeople.every((p) => pairAllowed(p!, cp))) return false;
    if (c.isSimulated) {
      if (opts.fillMode === "live") return false;
      if (opts.fillMode === "mixed" && !anchor.isSimulated && opts.now - anchor.joinedAt < mixedDelay) return false;
    }
    return true;
  };
  // A unit of friends is eligible only as a whole, and only if it fits beside the anchor's unit.
  const open = anchor.targetSize - anchorUnit.length;
  const eligibleUnits = unitsOf(pool.filter((c) => !inAnchorUnit.has(c.entryId))).filter(
    (u) => u.length <= open && u.every(eligibleItem) && (!u[0].groupId || u.every((c) => c.groupId === u[0].groupId)),
  );
  const eligibleCount = eligibleUnits.reduce((n, u) => n + u.length, 0);
  if (eligibleCount < open) return null;

  // Seeds: the anchor's unit alone, plus it + each of its top-3 partner units → diverse candidates.
  const unitScore = (u: Unit) => {
    let min = 1;
    for (const c of u) for (const p of unitPeople) min = Math.min(min, score(p!, people.get(c.userId)!).score);
    return min;
  };
  const ranked = [...eligibleUnits].sort((a, b) => unitScore(b) - unitScore(a));
  const seeds: QueueItem[][] = [anchorUnit, ...ranked.slice(0, 3).filter((r) => r.length <= open).map((r) => [...anchorUnit, ...r])];
  const seen = new Set<string>();
  const candidates: Candidate[] = [];
  for (const s of seeds) {
    const g = growGroup(s, eligibleUnits, anchor.targetSize, people, score);
    if (!g) continue;
    const key = g.map((x) => x.entryId).sort().join(",");
    if (seen.has(key)) continue;
    seen.add(key);
    const members = g.map((x) => people.get(x.userId)!);
    if (!validateParty(members).ok) continue; // belt and braces
    const cohesion = groupCohesion(members, score, cameTogetherMap(g));
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
  const triedGroups = new Set<string>();
  const out: { proposal: Proposal; chosen: Candidate }[] = [];
  for (const anchor of pool) {
    if (taken.has(anchor.entryId)) continue;
    // Friends who queued together are one unit: try it once per tick, from its first member.
    if (anchor.groupId) {
      if (triedGroups.has(anchor.groupId)) continue;
      triedGroups.add(anchor.groupId);
    }
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
  const anchorUnit = unitFor(anchor, waiting);
  const inUnit = new Set(anchorUnit.map((u) => u.entryId));
  const unitPeople = anchorUnit.map((u) => people.get(u.userId)).filter((p): p is Person => Boolean(p));
  const eligible = waiting.filter((c) => {
    if (inUnit.has(c.entryId) || anchorUnit.some((u) => u.userId === c.userId)) return false;
    if (c.targetSize !== anchor.targetSize || !queuesCompatible(anchor, c)) return false;
    if (bucketDistanceKm(anchor.bucketId, c.bucketId, landmarks) > radius) return false;
    if (c.isSimulated && opts.fillMode === "live") return false;
    const cp = people.get(c.userId);
    return Boolean(cp && unitPeople.every((p) => pairAllowed(p, cp)));
  });
  const units = unitsOf(eligible).filter((u) => !u[0].groupId || waiting.filter((w) => w.groupId === u[0].groupId).length === u.length);
  const cap = Math.min(anchor.targetSize, anchorUnit.length + units.reduce((n, u) => n + u.length, 0));
  // Fill as far as possible: try the full cap, then smaller, since units can't be split.
  let g: QueueItem[] | null = null;
  for (let size = cap; size >= anchorUnit.length && !g; size--) g = growGroup(anchorUnit, units, size, people, score);
  g = g ?? anchorUnit;
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
  const triedGroups = new Set<string>();
  let formed = 0;
  for (const anchor of pool) {
    if (taken.has(anchor.entryId)) continue;
    // Friends who queued together are one unit: try it once per tick, from its first member.
    if (anchor.groupId) {
      if (triedGroups.has(anchor.groupId)) continue;
      triedGroups.add(anchor.groupId);
    }
    if (anchor.isSimulated && opts.fillMode !== "simulated") continue;
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
