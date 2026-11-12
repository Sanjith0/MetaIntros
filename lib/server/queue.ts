import { prisma } from "@/lib/db";
import { PartySize } from "@/lib/domain/enums";
import { assignBucket, bucketDistanceKm } from "@/lib/match/buckets";
import { makePairScorer } from "@/lib/match/compat";
import { levelFor, playersFound, queuesCompatible, runTickAsync, type Candidate, type Proposal, type QueueItem, type QueueMode } from "@/lib/match/engine";
import { pairAllowed } from "@/lib/match/safety";
import { loadPeople, type Person } from "@/lib/profile/load";
import { publish } from "./bus";
import { setAiMode } from "@/lib/ai";
import { getFillMode, getSetting } from "./settings";
import { formParty, chooseCandidate } from "./pipeline";
import { checkStalls } from "./host";
import { sweepExpiredChats } from "./expiry";
import { now as clockNow } from "./clock";
import { weekendRange } from "./events";
import { nowMs } from "@/lib/clock";
import { PULSE_MIN } from "./pulse";
import { queuingWith } from "./queueGroups";

// ───────────────────────── join / leave ─────────────────────────

/** Friends' pages (Events rail, Home card, Friends tab) refresh when a visible queue changes. */
export async function notifyFriends(userId: string) {
  const fs = await prisma.friendship.findMany({ where: { OR: [{ userAId: userId }, { userBId: userId }] }, select: { userAId: true, userBId: true } });
  const ids = fs.map((f) => (f.userAId === userId ? f.userBId : f.userAId));
  if (ids.length) publish("friends", { type: "friend-queue" }, ids);
}

export interface JoinInput {
  /** "events" (default) = existing events; "hangout" = plan a new hangout (eventId must be null) */
  mode?: QueueMode;
  eventId: string | null;
  targetSize: number;
  /** GPS fix; ignored if landmarkId is given */
  lat?: number;
  lng?: number;
  /** manual area pick */
  landmarkId?: string;
  locationSource: "gps" | "manual" | "seed";
  /** let friends see this queue; omitted = your saved setting. Given = also remembered as your setting. */
  visibleToFriends?: boolean;
  /** joined from this friend's "Queue up too" */
  viaFriendId?: string;
}

export type JoinResult =
  | { ok: true; entryId: string; bucketId: string; bucketName: string }
  | { ok: false; error: "too_far" | "bad_size" | "private_event" | "no_event" | "no_location" | "bad_mode"; nearest?: string };

export type JoinError = Extract<JoinResult, { ok: false }>;

/**
 * Validate queue settings and resolve the area bucket (shared by solo joins and queuing with
 * friends, whose members all use the host's settings).
 */
export async function resolveJoin(input: JoinInput): Promise<
  | { ok: true; mode: QueueMode; bucket: { id: string; name: string }; lat: number; lng: number }
  | JoinError
> {
  if (!PartySize.safeParse(input.targetSize).success) return { ok: false, error: "bad_size" };
  const mode: QueueMode = input.mode ?? "events";
  if (mode !== "events" && mode !== "hangout") return { ok: false, error: "bad_mode" };
  if (mode === "hangout" && input.eventId) return { ok: false, error: "bad_mode" }; // hangouts are new, never an existing event
  if (input.eventId) {
    const ev = await prisma.event.findUnique({ where: { id: input.eventId } });
    if (!ev || ev.kind !== "event") return { ok: false, error: "no_event" }; // can't queue into another squad's hangout
    if (!ev.isPublicVenue) return { ok: false, error: "private_event" }; // hard rule: public venues only
  }
  const landmarks = await prisma.landmark.findMany();
  let bucket = input.landmarkId ? landmarks.find((l) => l.id === input.landmarkId) : undefined;
  let lat = input.lat, lng = input.lng;
  if (!bucket) {
    if (lat == null || lng == null) return { ok: false, error: "no_location" };
    const r = assignBucket({ lat, lng }, landmarks);
    if (!r.ok) return { ok: false, error: "too_far", nearest: r.nearest.id };
    bucket = r.landmark;
  } else {
    lat = bucket.lat;
    lng = bucket.lng;
  }
  return { ok: true, mode, bucket, lat: lat!, lng: lng! };
}

export async function joinQueue(userId: string, input: JoinInput): Promise<JoinResult> {
  const r = await resolveJoin(input);
  if (!r.ok) return r;
  const { mode, bucket, lat, lng } = r;

  await prisma.queueEntry.updateMany({ where: { userId, status: "waiting" }, data: { status: "left" } });
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  // Friends' queues: opt-in. The choice on the queue setup screen is remembered as your setting.
  const visibleToFriends = input.visibleToFriends ?? user.queueVisibility === "friends";
  if (input.visibleToFriends !== undefined && !user.isSimulated) {
    await prisma.user.update({ where: { id: userId }, data: { queueVisibility: visibleToFriends ? "friends" : "off", queueVisibilityAskedAt: user.queueVisibilityAskedAt ?? new Date(nowMs()) } });
  }
  const entry = await prisma.queueEntry.create({
    data: {
      userId, mode, eventId: input.eventId, targetPartySize: input.targetSize, lat: lat!, lng: lng!, bucketLandmarkId: bucket.id,
      visibleToFriends, viaFriendId: input.viaFriendId ?? null,
    },
  });
  if (!user.isSimulated) {
    // Seeded friends waiting in this exact queue (demo) start matching now that a real person is here.
    await prisma.queueEntry.updateMany({
      where: { parked: true, status: "waiting", mode, eventId: input.eventId, bucketLandmarkId: bucket.id, targetPartySize: input.targetSize },
      data: { parked: false },
    });
  }
  if (visibleToFriends) await notifyFriends(userId);
  if (!user.isSimulated) {
    // Location is used only to assign a bucket; the precise fix never leaves the server.
    await prisma.user.update({ where: { id: userId }, data: { locationSource: input.locationSource, homeLat: user.homeLat ?? lat, homeLng: user.homeLng ?? lng } });
    await scheduleSimulatedFill(entry.id);
  }
  ensureTicker();
  publish("queue", { type: "joined", userId });
  publish("demo", { type: "queue" });
  return { ok: true, entryId: entry.id, bucketId: bucket.id, bucketName: bucket.name };
}

export async function leaveQueue(userId: string) {
  const entries = await prisma.queueEntry.findMany({ where: { userId, status: "waiting" } });
  for (const e of entries) cancelSim(e.id);
  await prisma.queueEntry.updateMany({ where: { userId, status: "waiting" }, data: { status: "left" } });
  if (entries.some((e) => e.visibleToFriends)) await notifyFriends(userId);
  publish("demo", { type: "queue" });
}

// ───────────────────────── status ─────────────────────────

/**
 * Why a waiting entry can't currently be matched (shown on the queue screen, and the entry is
 * skipped by the matcher so it doesn't form-and-cancel parties every tick):
 * - no_events: "any event" queue, but no upcoming public events remain this weekend
 * - event_started: queued from an event that has already started
 * - no_fit: a squad formed but no event/spot fit everyone; retried after a cooldown
 */
export type QueueProblem = "no_events" | "event_started" | "no_fit";

export interface QueueStatus {
  state: "idle" | "waiting" | "matched";
  problem?: QueueProblem;
  bucketId?: string;
  entryId?: string;
  targetSize?: number;
  mode?: QueueMode;
  eventId?: string | null;
  bucketName?: string;
  waitedMs?: number;
  found?: number;
  foundUsers?: { id: string; name: string; avatarColor: string }[];
  /** Where the search reaches right now, for the queue screen's search map. Counts only, never faces. */
  searchArea?: SearchArea;
  partyId?: string | null;
  /** Queue with friends: the friends queuing with you (always shown with faces; strangers stay counts). */
  friends?: { id: string; name: string; avatarColor: string; isSimulated: boolean }[];
}

export interface SearchArea {
  /** Current search radius around your area; 0 = your area only. Grows as the search widens. */
  radiusKm: number;
  center: { id: string; name: string; lat: number; lng: number };
  /** Every area on the map. `waiting` is null below PULSE_MIN, so a small count never shows who's alone. */
  areas: { id: string; name: string; lat: number; lng: number; km: number; inRange: boolean; waiting: number | null }[];
}

/** The search map shows areas up to this far away (the widest simulated search level). */
export const SEARCH_MAP_KM = 15;

export async function getQueueStatus(userId: string): Promise<QueueStatus> {
  const entry = await prisma.queueEntry.findFirst({ where: { userId, status: { in: ["waiting", "matched"] } }, orderBy: { joinedAt: "desc" }, include: { bucketLandmark: true } });
  if (!entry) return { state: "idle" };
  if (entry.status === "matched") return { state: "matched", entryId: entry.id, partyId: entry.partyId, targetSize: entry.targetPartySize, mode: entry.mode as QueueMode, eventId: entry.eventId };
  ensureTicker();
  const waiting = await waitingItems();
  const people = await loadPeople(prisma, waiting.map((w) => w.userId));
  const landmarks = await landmarkMap();
  const problems = await entryProblems(waiting);
  const anchor = waiting.find((w) => w.entryId === entry.id);
  const pf = anchor ? playersFound(anchor, waiting, people, landmarks, { now: nowMs(), fillMode: await getFillMode() }) : { found: 1, userIds: [userId] };
  const users = await prisma.user.findMany({ where: { id: { in: pf.userIds } }, select: { id: true, name: true, avatarColor: true } });
  const searchArea = anchor ? searchAreaFor(anchor, waiting, people, landmarks, await getFillMode()) : undefined;
  const friends = await queuingWith(userId, entry.groupId);
  return {
    friends,
    state: "waiting",
    entryId: entry.id,
    targetSize: entry.targetPartySize,
    mode: entry.mode as QueueMode,
    eventId: entry.eventId,
    bucketName: entry.bucketLandmark.name,
    bucketId: entry.bucketLandmarkId,
    problem: problems.get(entry.id),
    waitedMs: nowMs() - entry.joinedAt.getTime(),
    found: pf.found,
    foundUsers: pf.userIds.map((id) => users.find((u) => u.id === id)!).filter(Boolean),
    searchArea,
  };
}

/** The areas your search reaches now, and how many compatible people wait in each (same filters as matching). */
function searchAreaFor(
  anchor: QueueItem,
  waiting: QueueItem[],
  people: Map<string, Person>,
  landmarks: Map<string, { id: string; name: string; lat: number; lng: number }>,
  fillMode: "simulated" | "mixed" | "live",
): SearchArea | undefined {
  const center = landmarks.get(anchor.bucketId);
  if (!center) return undefined;
  const { level } = levelFor(nowMs() - anchor.joinedAt, { fillMode });
  const me = people.get(anchor.userId);
  const counts = new Map<string, number>();
  for (const c of waiting) {
    if (c.userId === anchor.userId || !queuesCompatible(anchor, c)) continue;
    if (c.isSimulated && fillMode === "live") continue;
    const cp = people.get(c.userId);
    if (!me || !cp || !pairAllowed(me, cp)) continue;
    counts.set(c.bucketId, (counts.get(c.bucketId) ?? 0) + 1);
  }
  const areas = [...landmarks.values()]
    .map((l) => ({ l, km: bucketDistanceKm(center.id, l.id, landmarks) }))
    .filter(({ km }) => km <= SEARCH_MAP_KM)
    .map(({ l, km }) => {
      const n = counts.get(l.id) ?? 0;
      return { id: l.id, name: l.name, lat: l.lat, lng: l.lng, km: Math.round(km * 10) / 10, inRange: km <= level.radiusKm, waiting: n >= PULSE_MIN ? n : null };
    });
  return { radiusKm: level.radiusKm, center: { id: center.id, name: center.name, lat: center.lat, lng: center.lng }, areas };
}

// ───────────────────────── tick ─────────────────────────

async function waitingItems(): Promise<QueueItem[]> {
  // parked = a seeded friend's demo entry, held until a real person joins that queue (see joinQueue)
  const rows = await prisma.queueEntry.findMany({ where: { status: "waiting", parked: false }, include: { user: { select: { isSimulated: true } } } });
  return rows.map((r) => ({
    entryId: r.id,
    userId: r.userId,
    targetSize: r.targetPartySize,
    bucketId: r.bucketLandmarkId,
    eventId: r.eventId,
    mode: r.mode as QueueMode,
    joinedAt: r.joinedAt.getTime(),
    isSimulated: r.user.isSimulated,
    groupId: r.groupId,
  }));
}

async function landmarkMap() {
  return new Map((await prisma.landmark.findMany()).map((l) => [l.id, l]));
}

const NO_FIT_COOLDOWN_MS = 30_000;
const cooldowns = () => ((globalThis as unknown as { __quCooldown?: Map<string, number> }).__quCooldown ??= new Map());

/** Entries that can't be served right now, and why (see QueueProblem). */
async function entryProblems(waiting: QueueItem[]): Promise<Map<string, QueueProblem>> {
  const out = new Map<string, QueueProblem>();
  if (!waiting.length) return out;
  const now = await clockNow();
  const { end } = weekendRange(now);
  const anyEventsLeft = waiting.some((w) => (w.mode ?? "events") === "events" && !w.eventId)
    ? (await prisma.event.count({ where: { kind: "event", isPublicVenue: true, startsAt: { gt: now, lt: end } } })) > 0
    : true;
  const specific = [...new Set(waiting.map((w) => w.eventId).filter(Boolean))] as string[];
  const started = new Set(
    specific.length ? (await prisma.event.findMany({ where: { id: { in: specific }, startsAt: { lte: now } }, select: { id: true } })).map((e) => e.id) : [],
  );
  const cd = cooldowns();
  for (const w of waiting) {
    if ((w.mode ?? "events") === "events" && !w.eventId && !anyEventsLeft) out.set(w.entryId, "no_events");
    else if (w.eventId && started.has(w.eventId)) out.set(w.entryId, "event_started");
    else if ((cd.get(w.entryId) ?? 0) > nowMs()) out.set(w.entryId, "no_fit");
  }
  return out;
}

let ticking = false;

/** One matchmaking pass over the whole queue. Safe to call concurrently (re-entrancy guarded). */
export async function tick(): Promise<number> {
  if (ticking) return 0;
  ticking = true;
  try {
    const aiMode = await getSetting("aiMode", "");
    if (process.env.NODE_ENV !== "test" && (aiMode === "cache" || aiMode === "live")) setAiMode(aiMode);
    const all = await waitingItems();
    const problems = await entryProblems(all);
    // Unservable entries sit out (no form-then-cancel loop every tick); their screens explain why.
    const waiting = all.filter((w) => !problems.has(w.entryId));
    for (const w of all.filter((x) => problems.has(x.entryId) && !x.isSimulated)) publish("queue", { type: "problem" }, [w.userId]);
    if (waiting.length < 2) return 0;
    const people = await loadPeople(prisma, waiting.map((w) => w.userId));
    const landmarks = await landmarkMap();
    const fillMode = await getFillMode();
    const mixedFillDelayMs = Number(await getSetting("mixedFillDelayMs", "12000"));
    const score = makePairScorer();
    const formed = await runTickAsync(
      waiting,
      people,
      landmarks,
      { now: nowMs(), fillMode, mixedFillDelayMs },
      (p: Proposal) => chooseCandidate(p, people),
      async (p: Proposal, c: Candidate) => {
        const r = await formParty(p, c, people);
        if (r.partyId) for (const id of c.entryIds) cleanupSimFor(id);
        else if ("reason" in r && r.reason === "no_event") {
          // Nothing fits this squad right now: let them wait it out instead of retrying every tick.
          for (const id of c.entryIds) cooldowns().set(id, nowMs() + NO_FIT_COOLDOWN_MS);
          for (const u of c.userIds) publish("queue", { type: "problem" }, [u]);
        }
        return Boolean(r.partyId);
      },
      score,
    );
    // push fresh "players found" counts to waiting real users
    for (const w of waiting.filter((x) => !x.isSimulated)) publish("queue", { type: "tick" }, [w.userId]);
    return formed;
  } finally {
    ticking = false;
  }
}

const g = globalThis as unknown as { __quTicker?: NodeJS.Timeout; __quSim?: Map<string, { timers: NodeJS.Timeout[]; spawned: string[] }> };

export function ensureTicker() {
  if (process.env.NODE_ENV === "test" || g.__quTicker) return;
  g.__quTicker = setInterval(() => {
    tick().catch((e) => console.error("[queue tick]", e));
    checkStalls().catch((e) => console.error("[stalls]", e));
    sweepExpiredChats().catch((e) => console.error("[expiry]", e));
  }, Number(process.env.QUEUE_TICK_MS ?? 2000));
}

export function stopTicker() {
  if (g.__quTicker) clearInterval(g.__quTicker);
  g.__quTicker = undefined;
}

// ───────────────────────── simulated fill ─────────────────────────

const sims = () => (g.__quSim ??= new Map());

function cancelSim(entryId: string) {
  const s = sims().get(entryId);
  if (s) s.timers.forEach(clearTimeout);
}

/** After a real user's party forms, withdraw any simulated spares spawned for them. */
async function cleanupSimFor(entryId: string) {
  const s = sims().get(entryId);
  if (!s) return;
  s.timers.forEach(clearTimeout);
  sims().delete(entryId);
  if (s.spawned.length) await prisma.queueEntry.updateMany({ where: { id: { in: s.spawned }, status: "waiting" }, data: { status: "left" } });
}

export function cancelAllSims() {
  for (const s of sims().values()) s.timers.forEach(clearTimeout);
  sims().clear();
}

/**
 * Simulated users trickle into the queue so the room visibly fills (demo). Picks the most
 * compatible, safety-eligible simulated personas and stages their joins across simFillMs.
 * Live mode: never. Mixed mode: only after mixedFillDelayMs, and only for open slots.
 */
export async function scheduleSimulatedFill(entryId: string, opts: { immediate?: boolean } = {}) {
  const mode = await getFillMode();
  if (mode === "live") return;
  const fillMs = Number(await getSetting("simFillMs", "18000"));
  const delay = mode === "mixed" ? Number(await getSetting("mixedFillDelayMs", "12000")) : 0;
  const entry = await prisma.queueEntry.findUniqueOrThrow({ where: { id: entryId } });
  const rec = { timers: [] as NodeJS.Timeout[], spawned: [] as string[] };
  sims().set(entryId, rec);

  const plan = async () => {
    const fresh = await prisma.queueEntry.findUnique({ where: { id: entryId } });
    if (!fresh || fresh.status !== "waiting") return [];
    const busy = new Set((await prisma.queueEntry.findMany({ where: { status: "waiting" }, select: { userId: true } })).map((x) => x.userId));
    const sameSizeReal = await prisma.queueEntry.count({ where: { status: "waiting", targetPartySize: entry.targetPartySize, mode: entry.mode, user: { isSimulated: false }, ...(entry.groupId ? { groupId: { not: entry.groupId } } : {}) } });
    // Queuing with friends: the friends already fill their slots, so only the open ones need people.
    const friendsIn = entry.groupId ? await prisma.queueEntry.count({ where: { status: "waiting", groupId: entry.groupId } }) : 1;
    const need = Math.max(0, entry.targetPartySize - friendsIn - (sameSizeReal - (entry.groupId ? 0 : 1)));
    if (need === 0) return [];
    const sims = await prisma.user.findMany({ where: { isSimulated: true }, select: { id: true } });
    const friendIds = entry.groupId
      ? (await prisma.queueEntry.findMany({ where: { status: "waiting", groupId: entry.groupId }, select: { userId: true } })).map((x) => x.userId)
      : [entry.userId];
    const people = await loadPeople(prisma, [...new Set([entry.userId, ...friendIds, ...sims.map((s) => s.id)])]);
    const squad = friendIds.map((id) => people.get(id)).filter((p): p is Person => Boolean(p));
    const score = makePairScorer();
    const pool = [...people.values()].filter((p) => p.isSimulated && !busy.has(p.id) && squad.every((f) => pairAllowed(f, p)));
    // greedy: most compatible with the joiner *and* with already-picked fillers
    const picked: Person[] = [];
    while (picked.length < need + 1 && pool.length) {
      pool.sort((a, b) => fitScore(b) - fitScore(a) || a.id.localeCompare(b.id));
      const next = pool.shift()!;
      if (picked.every((p) => pairAllowed(p, next))) picked.push(next);
    }
    function fitScore(c: Person) {
      // Queuing with friends: fillers must fit every friend, not just the host.
      const all = [...squad, ...picked];
      return Math.min(...all.map((x) => score(x, c).score)) + Math.min(...squad.map((x) => score(x, c).score));
    }
    return picked;
  };

  const start = async () => {
    const picked = await plan();
    const step = picked.length ? fillMs / picked.length : 0;
    picked.forEach((p, i) => {
      const t = setTimeout(async () => {
        try {
          const still = await prisma.queueEntry.findUnique({ where: { id: entryId } });
          if (!still || still.status !== "waiting") return;
          const jitter = (k: number) => (((p.id.charCodeAt(p.id.length - 1) * (k + 3)) % 13) - 6) / 10000;
          const e = await prisma.queueEntry.create({
            data: {
              userId: p.id,
              mode: entry.mode,
              eventId: entry.eventId,
              targetPartySize: entry.targetPartySize,
              lat: entry.lat + jitter(1),
              lng: entry.lng + jitter(2),
              bucketLandmarkId: entry.bucketLandmarkId,
            },
          });
          rec.spawned.push(e.id);
          publish("queue", { type: "joined", userId: p.id });
          publish("demo", { type: "queue" });
          if (process.env.NODE_ENV !== "test") tick().catch(() => {});
        } catch (err) {
          console.error("[sim join]", err);
        }
      }, opts.immediate ? 0 : Math.round(step * (i + 0.5)));
      rec.timers.push(t);
    });
  };

  if (delay > 0 && !opts.immediate) rec.timers.push(setTimeout(() => start().catch(() => {}), delay));
  else await start();
}
