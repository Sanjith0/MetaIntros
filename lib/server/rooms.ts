/**
 * Runs the Companion engine for one queue "room" and turns what the Companions and the
 * Orchestrator decided into the Candidate objects the party pipeline commits.
 */
import { prisma } from "@/lib/db";
import { toJson } from "@/lib/json";
import { pairKey, runRoom, sparksFor, type HumanCheckIns, type LiveEvent, type PicksAnswer, type PicksOffer, type RoomParty, type SignoffAnswer, type SignoffOffer } from "@/lib/companion/room";
import { cleanNote } from "@/lib/companion/brief";
import { buildRecap, type Recap } from "@/lib/companion/recap";
import type { TableRow, Verdict } from "@/lib/companion/orchestrator";
import type { ThreadMsg } from "@/lib/companion/rounds";
import type { QueueContext } from "@/lib/companion/brief";
import { groupCohesion } from "@/lib/match/cohesion";
import { makePairScorer } from "@/lib/match/compat";
import type { Candidate, QueueItem } from "@/lib/match/engine";
import type { Person } from "@/lib/profile/load";
import { rankEvents, type GroupContext } from "@/lib/match/eventFit";
import { rankHangouts } from "@/lib/match/hangoutFit";
import { dislikeTags } from "@/lib/profile/builder";
import { ensureBriefs, rememberTold } from "./briefs";
import { ratingSignals } from "./ratings";
import { againPairsIn, type PairSignals } from "@/lib/match/ratings";
import { getSetting } from "./settings";
import { now as clockNow } from "./clock";
import { weekendRange } from "./events";
import { HANGOUT_SPOTS, hangoutHorizon } from "./hangout";
import { publish } from "./bus";

export interface PendingRoom {
  signature: string;
  userIds: string[];
  party: RoomParty;
  preChats: { a: string; b: string; transcript: { speaker: "A" | "B"; text: string }[]; sparks: string[] }[];
  /** what each member gets to see about how the squad was decided */
  recaps: Map<string, Recap>;
  /** where the Companions' words came from (live Muse, replay, templates, or a mix) */
  source: string;
}

/** A room as it happens, for the people in it to watch (see liveViewFor). In memory only. */
export interface LiveRoom {
  id: string;
  userIds: Set<string>;
  startedAt: number;
  stage: string;
  note: string;
  circles: { id: string; theme: string; members: string[] }[];
  lines: ThreadMsg[];
  notes: Map<string, Map<string, Verdict>>;
  deep: Set<string>;
  proposals: TableRow[];
  groups: Map<string, { members: string[]; lines: { from: string; say: string }[]; ok?: boolean }>;
  /** queue together: userId → groupId (these people already know each other) */
  together: Map<string, string>;
}

interface State {
  /** candidate key → what the engine decided for it */
  pending: Map<string, PendingRoom>;
  /** room signature → member sets that could not be committed */
  failed: Map<string, string[][]>;
  /** room signatures that ended with nothing to commit → their entry ids */
  settled: Map<string, Set<string>>;
  live: LiveRoom[];
}
const g = globalThis as unknown as { __quRooms?: State };
const state = () => (g.__quRooms ??= { pending: new Map(), failed: new Map(), settled: new Map(), live: [] });

const candKey = (c: Pick<Candidate, "entryIds">) => [...c.entryIds].sort().join(",");

export function resetRooms() {
  g.__quRooms = undefined;
}

/** The engine's decision for a candidate (removed once taken). */
export function takePending(c: Candidate): PendingRoom | null {
  const k = candKey(c);
  const p = state().pending.get(k) ?? null;
  state().pending.delete(k);
  return p;
}

/** A squad the engine chose could not be committed: never propose that exact group from this room again. */
export function markFailed(room: PendingRoom | null) {
  if (!room) return;
  const s = state();
  s.failed.set(room.signature, [...(s.failed.get(room.signature) ?? []), room.userIds]);
  s.settled.delete(room.signature);
}

/** How many pairs in a group said they'd squad up again (post-event ratings). */
const againPairsFor = (signals: PairSignals) => (members: string[]) => againPairsIn(members, signals);

const wrap = (ids: string[]) => `,${ids.join(",")},`;

/**
 * Can this group actually meet? The Companions judge who gets along; code makes sure a squad is
 * only formed if there is somewhere it can go: a public hangout spot near everyone with a slot
 * they can all make, or (in the "any event" queue) an event that fits all of them.
 */
async function feasibility(anchor: QueueItem, room: QueueItem[], people: Map<string, Person>): Promise<((members: string[]) => boolean) | undefined> {
  const mode = anchor.mode ?? "events";
  const eventId = room.find((r) => r.eventId)?.eventId ?? null;
  if (mode === "events" && eventId) return undefined; // everyone goes to the event they queued for
  const landmarks = new Map((await prisma.landmark.findMany()).map((l) => [l.id, l]));
  const now = await clockNow();
  const entryOf = new Map(room.map((r) => [r.userId, r]));
  const score = makePairScorer();
  const context = (members: string[]): GroupContext => {
    const ps = members.map((m) => people.get(m)!);
    const tagCounts = new Map<string, number>();
    for (const p of ps) for (const t of p.profile.interestTags) tagCounts.set(t.tag, (tagCounts.get(t.tag) ?? 0) + 1);
    const dislikes = new Map<string, string[]>();
    for (const p of ps) for (const t of dislikeTags(p.profile)) dislikes.set(t, [...(dislikes.get(t) ?? []), p.id]);
    return { sharedWindows: groupCohesion(ps, score).sharedWindows, tagCounts, dislikes, center: landmarks.get(anchor.bucketId)!, size: ps.length };
  };
  if (mode === "hangout") {
    const horizon = hangoutHorizon(now); // exactly what the Hangout Planner will use
    return (members) => {
      const g = context(members);
      const areas = members.map((m) => landmarks.get(entryOf.get(m)!.bucketId)!);
      return rankHangouts(HANGOUT_SPOTS, { sharedWindows: g.sharedWindows, tagCounts: g.tagCounts, dislikes: g.dislikes, size: g.size, memberAreas: areas }, now, horizon).some((o) => o.ok);
    };
  }
  const { end } = weekendRange(now);
  const events = (await prisma.event.findMany({ where: { kind: "event", startsAt: { gt: now, lt: end } } })).map((e) => ({ ...e, tags: e.tags as string[] }));
  return (members) => rankEvents(events, context(members), now).some((r) => r.ok);
}

/**
 * Run the Companion engine for one room. `onNoFit` is called with the real people's entry ids when
 * the Companions found groups but none of them had a place and time they could all make.
 */
export async function matchRoom(anchor: QueueItem, room: QueueItem[], people: Map<string, Person>, onNoFit?: (entryIds: string[]) => void, similarity?: (a: Person, b: Person) => { score: number }): Promise<Candidate[]> {
  const s = state();
  const signature = room.map((r) => r.entryId).sort().join(",");
  // The same people (or a subset of them) already talked and found no squad: don't run them again.
  if ([...s.settled.values()].some((done) => room.every((r) => done.has(r.entryId)))) return [];
  const userIds = room.map((r) => r.userId);
  const entryOf = new Map(room.map((r) => [r.userId, r]));
  const real = userIds.filter((u) => !people.get(u)!.isSimulated);
  const eventId = room.find((r) => r.eventId)?.eventId ?? null;
  const event = eventId ? await prisma.event.findUnique({ where: { id: eventId }, select: { title: true } }) : null;
  const ctx: QueueContext = { mode: anchor.mode ?? "events", eventTitle: event?.title ?? null, targetSize: anchor.targetSize };

  const notes = new Map(
    (await prisma.queueEntry.findMany({ where: { id: { in: room.map((r) => r.entryId) } }, select: { userId: true, tonight: true } }))
      .filter((e) => e.tonight)
      .map((e) => [e.userId, e.tonight!] as const),
  );
  const row = await prisma.matchRoom.create({ data: { signature, anchorUserId: anchor.userId, userIds: wrap(userIds), stage: "briefing", note: "Companions are reading their people's profiles" } });
  const watch: LiveRoom = { id: row.id, userIds: new Set(userIds), startedAt: Date.now(), stage: row.stage, note: row.note, circles: [], lines: [], notes: new Map(), deep: new Set(), proposals: [], groups: new Map(), together: new Map(room.filter((r) => r.groupId).map((r) => [r.userId, r.groupId!])) };
  s.live = [watch, ...s.live].slice(0, 20);
  const announce = (stage: string, note: string) => {
    watch.stage = stage;
    watch.note = note;
    publish("queue", { type: "stage", stage, note }, real);
  };
  announce(row.stage, row.note);
  try {
    // A brief costs a model call only when a real person is in the room.
    const canMeet = await feasibility(anchor, room, people);
    let ruledOut = 0;
    const feasible = canMeet && ((members: string[]) => (canMeet(members) ? true : (ruledOut++, false)));
    const briefs = await ensureBriefs(userIds.map((u) => people.get(u)!), ctx, () => real.length > 0, notes);
    const result = await runRoom({
      ids: userIds,
      people,
      briefs,
      targetSize: anchor.targetSize,
      exclude: s.failed.get(signature) ?? [],
      // Real people are placed first; squads made only of simulated fillers are not formed.
      priority: real.length ? real : [anchor.userId],
      onlyPriority: true,
      feasible,
      onLive: (e) => record(watch, e),
      human: await checkInsFor(watch, real),
      // queue together: these people land in the same squad, or none of them does
      together: new Map(room.filter((r) => r.groupId).map((r) => [r.userId, r.groupId!])),
      similarity,
      // post-event ratings: pairs who said they'd squad up again (counts only, never names)
      againPairs: againPairsFor(await ratingSignals(userIds)),
      onStage: async (stage, note) => {
        if (stage === "done" || stage === "waiting") return;
        await prisma.matchRoom.update({ where: { id: row.id }, data: { stage, note } });
        announce(stage, note);
      },
    });

    const score = makePairScorer();
    // Only squads with the anchor or a real person are committed; simulated spares are withdrawn afterwards.
    const keep = result.parties.filter((p) => p.members.includes(anchor.userId) || p.members.some((m) => !people.get(m)!.isSimulated));
    keep.sort((a, b) => Number(b.members.includes(anchor.userId)) - Number(a.members.includes(anchor.userId)));
    const candidates: Candidate[] = keep.map((party) => {
      const members = party.members;
      const c: Candidate = {
        entryIds: members.map((m) => entryOf.get(m)!.entryId),
        userIds: members,
        eventId: members.map((m) => entryOf.get(m)!.eventId).find(Boolean) ?? null,
        cohesion: groupCohesion(members.map((m) => people.get(m)!), score),
      };
      const preChats: PendingRoom["preChats"] = [];
      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          const [a, b] = members[i] < members[j] ? [members[i], members[j]] : [members[j], members[i]];
          const thread = result.threads.get(pairKey(a, b));
          if (!thread) continue;
          preChats.push({ a, b, transcript: thread.map((m) => ({ speaker: m.from === a ? ("A" as const) : ("B" as const), text: m.say })), sparks: sparksFor(a, b, result) });
        }
      }
      const recaps = new Map(members.map((m) => [m, buildRecap(m, party, result, people, userIds)]));
      s.pending.set(candKey(c), { signature, userIds: members, party, preChats, recaps, source: result.source });
      return c;
    });

    const stage = candidates.length ? "done" : "waiting";
    await prisma.matchRoom.update({
      where: { id: row.id },
      data: { stage, note: candidates.length ? "Squad chosen" : "No squad clicked yet", result: toJson({ circles: result.circles.map((c) => ({ id: c.id, theme: c.theme, size: c.members.length })), squads: candidates.length, revisedAfterSignOff: result.vetoed.length, modelCalls: result.calls }) },
    });
    announce(stage, "");
    if (!candidates.length) {
      s.settled.set(signature, new Set(room.map((r) => r.entryId)));
      if (ruledOut > 0) onNoFit?.(room.filter((r) => r.userId === anchor.userId || !people.get(r.userId)!.isSimulated).map((r) => r.entryId));
    }
    return candidates;
  } catch (e) {
    console.error("[room]", e);
    await prisma.matchRoom.update({ where: { id: row.id }, data: { stage: "waiting", note: "", result: toJson({ error: true }) } }).catch(() => {});
    return [];
  }
}

/** Did this person's latest room (since they joined the queue) end without a squad? */
export async function lastRoomFoundNoSquad(userId: string, since: Date): Promise<boolean> {
  const row = await prisma.matchRoom.findFirst({ where: { userIds: { contains: `,${userId},` }, createdAt: { gte: since } }, orderBy: { createdAt: "desc" }, select: { stage: true, result: true } });
  return row?.stage === "waiting" && !(row.result as { error?: boolean } | null)?.error;
}

/** What the engine is doing right now for a waiting user, if a room is running for them. */
export async function roomStageFor(userId: string): Promise<{ stage: string; note: string } | null> {
  const row = await prisma.matchRoom.findFirst({
    where: { userIds: { contains: `,${userId},` }, stage: { notIn: ["done", "waiting"] }, updatedAt: { gt: new Date(Date.now() - 5 * 60_000) } },
    orderBy: { createdAt: "desc" },
    select: { stage: true, note: true },
  });
  return row;
}

function record(w: LiveRoom, e: LiveEvent) {
  switch (e.type) {
    case "circle":
      w.circles.push({ id: e.circleId, theme: e.theme, members: e.members });
      break;
    case "line":
      w.lines.push(e.line);
      break;
    case "notes": {
      const m = w.notes.get(e.from) ?? new Map<string, Verdict>();
      for (const [about, v] of e.notes) m.set(about, v);
      w.notes.set(e.from, m);
      break;
    }
    case "deep":
      for (const [a, b] of e.pairs) w.deep.add(pairKey(a, b));
      break;
    case "proposal":
      w.proposals.push(e.row);
      break;
    case "table":
      w.proposals = [...w.proposals.filter((p) => !e.rows.some((r) => r.id === p.id)), ...e.rows];
      break;
    case "group": {
      const gr = w.groups.get(e.groupId) ?? { members: e.members, lines: [] };
      gr.lines.push(e.line);
      w.groups.set(e.groupId, gr);
      break;
    }
    case "groupDone": {
      const gr = w.groups.get(e.groupId) ?? { members: e.members, lines: [] };
      gr.ok = e.ok;
      w.groups.set(e.groupId, gr);
      break;
    }
  }
}

/* ───────────────────────── check-ins ───────────────────────── */

export const DEFAULT_CHECKIN_MS = 45_000;

/** How long a check-in waits for a person before their Companion goes ahead (0 = no check-ins). */
export async function checkInMs(): Promise<number> {
  const v = Number(await getSetting("checkinMs", process.env.CHECKIN_MS ?? String(DEFAULT_CHECKIN_MS)));
  return Number.isFinite(v) && v > 0 ? Math.min(v, 120_000) : 0;
}

type CheckIn =
  | { id: string; roomId: string; userId: string; kind: "picks"; offer: PicksOffer; expiresAt: number; resolve: (a: PicksAnswer | null) => void }
  | { id: string; roomId: string; userId: string; kind: "signoff"; offer: SignoffOffer; expiresAt: number; resolve: (a: SignoffAnswer | null) => void };

const gc = globalThis as unknown as { __quCheckIns?: Map<string, CheckIn> };
const checkIns = () => (gc.__quCheckIns ??= new Map());
let seq = 0;

function ask<A>(w: LiveRoom, userId: string, kind: CheckIn["kind"], offer: PicksOffer | SignoffOffer, ms: number): Promise<A | null> {
  return new Promise((done) => {
    const id = `ci-${Date.now().toString(36)}-${++seq}`;
    const finish = (a: A | null) => {
      if (!checkIns().has(id)) return;
      checkIns().delete(id);
      clearTimeout(timer);
      done(a);
      publish("queue", { type: "checkin" }, [userId]);
    };
    const timer = setTimeout(() => finish(null), ms);
    checkIns().set(id, { id, roomId: w.id, userId, kind, offer, expiresAt: Date.now() + ms, resolve: finish } as CheckIn);
    publish("queue", { type: "checkin" }, [userId]);
  });
}

/** Check-ins for the real people in this room; none when check-ins are switched off. */
async function checkInsFor(w: LiveRoom, real: string[]): Promise<HumanCheckIns | undefined> {
  const ms = await checkInMs();
  if (!ms || !real.length) return undefined;
  // The final yes/no is main's ready check ("I'm in" after the squad and plan are set), so the room
  // itself only checks the Companion's picks with each person.
  return { picks: (userId, offer) => ask<PicksAnswer>(w, userId, "picks", offer, ms) };
}

/** Answer every pending check-in with "no answer" (demo reset). */
export function cancelCheckIns() {
  for (const c of [...checkIns().values()]) c.resolve(null);
}

export type CheckInReply = { drop?: unknown; told?: unknown; decision?: unknown };

/** A person answers their own pending check-in. */
export async function answerCheckIn(userId: string, id: string, reply: CheckInReply): Promise<{ ok: true } | { ok: false; error: "not_found" | "bad_answer" | "sensitive" }> {
  const c = checkIns().get(id);
  if (!c || c.userId !== userId) return { ok: false, error: "not_found" };
  if (c.kind === "picks") {
    const allowed = new Set([...c.offer.picks, ...c.offer.others].map((p) => p.id));
    const drop = Array.isArray(reply.drop) ? reply.drop.filter((d): d is string => typeof d === "string" && allowed.has(d)) : [];
    const told = cleanNote(reply.told);
    if (told === "sensitive") return { ok: false, error: "sensitive" };
    if (told) await rememberTold(userId, told).catch(() => {});
    c.resolve({ drop, ...(told ? { told } : {}) });
    return { ok: true };
  }
  if (reply.decision !== "yes" && reply.decision !== "no") return { ok: false, error: "bad_answer" };
  c.resolve({ decision: reply.decision });
  return { ok: true };
}

export interface CheckInView {
  id: string;
  kind: "picks" | "signoff";
  secondsLeft: number;
  picks?: PicksOffer;
  signoff?: SignoffOffer;
}

function checkInFor(userId: string): CheckInView | null {
  const c = [...checkIns().values()].find((x) => x.userId === userId);
  if (!c) return null;
  const secondsLeft = Math.max(0, Math.round((c.expiresAt - Date.now()) / 1000));
  return c.kind === "picks" ? { id: c.id, kind: "picks", secondsLeft, picks: c.offer } : { id: c.id, kind: "signoff", secondsLeft, signoff: c.offer };
}

export interface LiveView {
  stage: string;
  note: string;
  roomSize: number;
  circle: { theme: string; size: number } | null;
  people: Record<string, { name: string; avatarColor: string }>;
  conversations: {
    with: string;
    deep: boolean;
    /** this person's own Companion's notes on them (never theirs on you) */
    notes: Verdict | null;
    lines: { from: "me" | "them"; kind: ThreadMsg["kind"]; say: string; blocked: boolean }[];
  }[];
  /** squads proposed that include this person */
  proposals: { by: string; members: string[]; line: string; backers: number }[];
  /** group conversations this person was part of */
  groups: { members: string[]; lines: { from: string; say: string }[]; status: "talking" | "agreed" | "didnt_work" }[];
  /** a question this person's Companion is waiting on, if any */
  checkIn: CheckInView | null;
}

/**
 * The latest room this person is in, as they are allowed to see it: only conversations their own
 * Companion was part of, only their own Companion's notes, and proposals and group conversations
 * that include them. A squad that didn't work out never says whose Companion declined.
 */
export async function liveViewFor(userId: string): Promise<LiveView | null> {
  const w = state().live.find((r) => r.userIds.has(userId));
  if (!w) return null;
  const byOther = new Map<string, LiveView["conversations"][number]["lines"]>();
  for (const l of w.lines) {
    if (l.from !== userId && l.to !== userId) continue;
    const other = l.from === userId ? l.to : l.from;
    byOther.set(other, [...(byOther.get(other) ?? []), { from: l.from === userId ? "me" : "them", kind: l.kind, say: l.say, blocked: l.blocked }]);
  }
  const mine = w.notes.get(userId);
  const order = (k: ThreadMsg["kind"]) => ["intro", "ask", "answer", "followup", "close"].indexOf(k);
  const conversations = [...byOther.entries()]
    .map(([other, lines]) => ({
      with: other,
      deep: w.deep.has(pairKey(userId, other)),
      notes: mine?.get(other) ?? null,
      lines: [...lines].sort((a, b) => order(a.kind) - order(b.kind) || Number(a.from === "them") - Number(b.from === "them")),
    }))
    .sort((a, b) => Number(b.deep) - Number(a.deep) || (b.notes?.score ?? -1) - (a.notes?.score ?? -1) || a.with.localeCompare(b.with));
  const proposals = w.proposals.filter((p) => p.members.includes(userId)).map((p) => ({ by: p.by, members: p.members, line: p.line, backers: p.backers.length }));
  const groups = [...w.groups.values()]
    .filter((gr) => gr.members.includes(userId))
    .map((gr) => ({ members: gr.members, lines: gr.lines, status: gr.ok === undefined ? ("talking" as const) : gr.ok ? ("agreed" as const) : ("didnt_work" as const) }));
  const circle = w.circles.find((c) => c.members.includes(userId));
  const checkIn = checkInFor(userId);
  const offered = checkIn?.picks ? [...checkIn.picks.picks, ...checkIn.picks.others].map((p) => p.id) : checkIn?.signoff?.members ?? [];
  const ids = [...new Set([userId, ...conversations.map((c) => c.with), ...proposals.flatMap((p) => p.members), ...groups.flatMap((gr) => gr.members), ...offered])];
  const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, avatarColor: true } });
  // Until the squad is ready, nobody sees who else is in the queue (DESIGN: "Nobody sees you yet").
  // Everyone except you and the people you queued together with is "Person A", "Person B"…, with a
  // blurred avatar, and their first names are swapped out of the Companions' lines too.
  const mates = new Set((w.together.get(userId) ? [...w.together].filter(([, g]) => g === w.together.get(userId)).map(([u]) => u) : []).concat(userId));
  const order2 = [...ids.filter((id) => !mates.has(id))].sort((x, y) => conversations.findIndex((c) => c.with === x) - conversations.findIndex((c) => c.with === y) || x.localeCompare(y));
  const alias = new Map(order2.map((id, i) => [id, `Person ${String.fromCharCode(65 + (i % 26))}${i >= 26 ? Math.floor(i / 26) : ""}`]));
  const firstNames = users.filter((u) => alias.has(u.id)).map((u) => ({ re: new RegExp(`\\b${u.name.split(" ")[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g"), to: alias.get(u.id)! }));
  const scrub = (t: string) => firstNames.reduce((acc, f) => acc.replace(f.re, f.to), t);
  const scrubNotes = (n: Verdict | null) => (n ? { ...n, wouldEnjoy: n.wouldEnjoy.map(scrub), concerns: n.concerns.map(scrub), needs: n.needs.map(scrub), opener: scrub(n.opener) } : n);
  return {
    stage: w.stage,
    note: w.note,
    roomSize: w.userIds.size,
    circle: circle ? { theme: circle.theme, size: circle.members.length } : null,
    people: Object.fromEntries(users.map((u) => [u.id, alias.has(u.id) ? { name: alias.get(u.id)!, avatarColor: u.avatarColor, anonymous: true } : { name: u.name, avatarColor: u.avatarColor }])),
    conversations: conversations.map((c) => ({ ...c, notes: scrubNotes(c.notes), lines: c.lines.map((l) => ({ ...l, say: scrub(l.say) })) })),
    proposals: proposals.map((p) => ({ ...p, line: scrub(p.line) })),
    groups: groups.map((g) => ({ ...g, lines: g.lines.map((l) => ({ ...l, say: scrub(l.say) })) })),
    checkIn: checkIn && {
      ...checkIn,
      ...(checkIn.picks ? { picks: { ...checkIn.picks, picks: checkIn.picks.picks.map((p) => ({ ...p, why: scrub(p.why) })) } } : {}),
      ...(checkIn.signoff ? { signoff: { ...checkIn.signoff, companionSaid: scrub(checkIn.signoff.companionSaid), groupLines: checkIn.signoff.groupLines.map((l) => ({ ...l, say: scrub(l.say) })) } } : {}),
    },
  };
}
