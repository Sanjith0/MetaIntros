import { prisma } from "@/lib/db";
import { PartySize } from "@/lib/domain/enums";
import { assignBucket } from "@/lib/match/buckets";
import { makePairScorer } from "@/lib/match/compat";
import { playersFound, runTickAsync, type Candidate, type Proposal, type QueueItem } from "@/lib/match/engine";
import { pairAllowed } from "@/lib/match/safety";
import { loadPeople, type Person } from "@/lib/profile/load";
import { publish } from "./bus";
import { getFillMode, getSetting } from "./settings";
import { formParty, chooseCandidate } from "./pipeline";

// ───────────────────────── join / leave ─────────────────────────

export interface JoinInput {
  eventId: string | null;
  targetSize: number;
  /** GPS fix; ignored if landmarkId is given */
  lat?: number;
  lng?: number;
  /** manual area pick */
  landmarkId?: string;
  locationSource: "gps" | "manual" | "seed";
}

export type JoinResult =
  | { ok: true; entryId: string; bucketId: string; bucketName: string }
  | { ok: false; error: "too_far" | "bad_size" | "private_event" | "no_event" | "no_location"; nearest?: string };

export async function joinQueue(userId: string, input: JoinInput): Promise<JoinResult> {
  if (!PartySize.safeParse(input.targetSize).success) return { ok: false, error: "bad_size" };
  if (input.eventId) {
    const ev = await prisma.event.findUnique({ where: { id: input.eventId } });
    if (!ev) return { ok: false, error: "no_event" };
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

  await prisma.queueEntry.updateMany({ where: { userId, status: "waiting" }, data: { status: "left" } });
  const entry = await prisma.queueEntry.create({
    data: { userId, eventId: input.eventId, targetPartySize: input.targetSize, lat: lat!, lng: lng!, bucketLandmarkId: bucket.id },
  });
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
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
  publish("demo", { type: "queue" });
}

// ───────────────────────── status ─────────────────────────

export interface QueueStatus {
  state: "idle" | "waiting" | "matched";
  entryId?: string;
  targetSize?: number;
  eventId?: string | null;
  bucketName?: string;
  waitedMs?: number;
  found?: number;
  foundUsers?: { id: string; name: string; avatarColor: string }[];
  partyId?: string | null;
}

export async function getQueueStatus(userId: string): Promise<QueueStatus> {
  const entry = await prisma.queueEntry.findFirst({ where: { userId, status: { in: ["waiting", "matched"] } }, orderBy: { joinedAt: "desc" }, include: { bucketLandmark: true } });
  if (!entry) return { state: "idle" };
  if (entry.status === "matched") return { state: "matched", entryId: entry.id, partyId: entry.partyId, targetSize: entry.targetPartySize, eventId: entry.eventId };
  ensureTicker();
  const waiting = await waitingItems();
  const people = await loadPeople(prisma, waiting.map((w) => w.userId));
  const landmarks = await landmarkMap();
  const anchor = waiting.find((w) => w.entryId === entry.id);
  const pf = anchor ? playersFound(anchor, waiting, people, landmarks, { now: Date.now(), fillMode: await getFillMode() }) : { found: 1, userIds: [userId] };
  const users = await prisma.user.findMany({ where: { id: { in: pf.userIds } }, select: { id: true, name: true, avatarColor: true } });
  return {
    state: "waiting",
    entryId: entry.id,
    targetSize: entry.targetPartySize,
    eventId: entry.eventId,
    bucketName: entry.bucketLandmark.name,
    waitedMs: Date.now() - entry.joinedAt.getTime(),
    found: pf.found,
    foundUsers: pf.userIds.map((id) => users.find((u) => u.id === id)!).filter(Boolean),
  };
}

// ───────────────────────── tick ─────────────────────────

async function waitingItems(): Promise<QueueItem[]> {
  const rows = await prisma.queueEntry.findMany({ where: { status: "waiting" }, include: { user: { select: { isSimulated: true } } } });
  return rows.map((r) => ({
    entryId: r.id,
    userId: r.userId,
    targetSize: r.targetPartySize,
    bucketId: r.bucketLandmarkId,
    eventId: r.eventId,
    joinedAt: r.joinedAt.getTime(),
    isSimulated: r.user.isSimulated,
  }));
}

async function landmarkMap() {
  return new Map((await prisma.landmark.findMany()).map((l) => [l.id, l]));
}

let ticking = false;

/** One matchmaking pass over the whole queue. Safe to call concurrently (re-entrancy guarded). */
export async function tick(): Promise<number> {
  if (ticking) return 0;
  ticking = true;
  try {
    const waiting = await waitingItems();
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
      { now: Date.now(), fillMode, mixedFillDelayMs },
      (p: Proposal) => chooseCandidate(p, people),
      async (p: Proposal, c: Candidate) => {
        const partyId = await formParty(p, c, people);
        if (partyId) for (const id of c.entryIds) cleanupSimFor(id);
        return Boolean(partyId);
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
    const sameSizeReal = await prisma.queueEntry.count({ where: { status: "waiting", targetPartySize: entry.targetPartySize, user: { isSimulated: false } } });
    const need = Math.max(0, entry.targetPartySize - sameSizeReal);
    if (need === 0) return [];
    const sims = await prisma.user.findMany({ where: { isSimulated: true }, select: { id: true } });
    const people = await loadPeople(prisma, [entry.userId, ...sims.map((s) => s.id)]);
    const me = people.get(entry.userId)!;
    const score = makePairScorer();
    const pool = [...people.values()].filter((p) => p.isSimulated && !busy.has(p.id) && pairAllowed(me, p));
    // greedy: most compatible with the joiner *and* with already-picked fillers
    const picked: Person[] = [];
    while (picked.length < need + 1 && pool.length) {
      pool.sort((a, b) => fitScore(b) - fitScore(a) || a.id.localeCompare(b.id));
      const next = pool.shift()!;
      if (picked.every((p) => pairAllowed(p, next))) picked.push(next);
    }
    function fitScore(c: Person) {
      const all = [me, ...picked];
      return Math.min(...all.map((x) => score(x, c).score)) + score(me, c).score;
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
