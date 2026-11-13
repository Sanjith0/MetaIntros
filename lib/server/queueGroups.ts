/**
 * Queue with friends. A host picks friends on the queue sheet; they get an invite (Notifications);
 * the host starts queuing once at least one friend is in. Everyone in then gets their own
 * QueueEntry with the host's settings, the same join time and the same groupId, and the matcher
 * treats them as one unit: always in the same squad, never split (lib/match/engine.ts).
 *
 * Rules (code, not the model):
 * - Only direct friends of the host can be invited or ask to join.
 * - Everyone in the group must be allowed in one squad with everyone else (pairAllowed: same age
 *   band, no blocks, women-only). Checked at invite, at accept and again at start.
 * - 18+ only, like solo queuing.
 * - The group must leave at least one slot open for someone new (there is no other size cap).
 */
import { prisma } from "@/lib/db";
import { nowDate } from "@/lib/clock";
import { matchBand } from "@/lib/domain/enums";
import { pairAllowed } from "@/lib/match/safety";
import { loadPeople } from "@/lib/profile/load";
import { publish } from "./bus";
import { friendIdsOf } from "./events";
import { ensureTicker, resolveJoin, scheduleSimulatedFill, type JoinError, type JoinInput } from "./queue";
import { isAdultBand } from "./signup";

export type GroupStatus = "gathering" | "queued" | "matched" | "cancelled";
/** host · invited (no answer yet) · in · declined · left (left the group or the queue) · missed (host started without them) */
export type SeatStatus = "host" | "invited" | "in" | "declined" | "left" | "missed";

export type FriendBlocker = "age_band" | "women_only" | "blocked" | "busy" | "under_18";

/** Simulated friends answer an invite on their own after this long (demo). */
export const SIM_ACCEPT_MS = 2_500;

const userSel = { id: true, name: true, avatarColor: true, isSimulated: true } as const;

/** Why a friend can't queue with this set of people, or null if they can. */
async function blockerFor(friendId: string, withIds: string[]): Promise<FriendBlocker | null> {
  const people = await loadPeople(prisma, [friendId, ...withIds]);
  const f = people.get(friendId);
  if (!f || !isAdultBand(f.ageBand)) return "under_18";
  for (const id of withIds) {
    const o = people.get(id);
    if (!o) continue;
    if (o.blocked.has(f.id) || f.blocked.has(o.id)) return "blocked";
    if (matchBand(o.ageBand) !== matchBand(f.ageBand)) return "age_band";
    if (!pairAllowed(o, f)) return "women_only";
  }
  return null;
}

/** Is this user already queuing or in another open group? */
async function isBusy(userId: string, exceptGroupId?: string) {
  const [waiting, seat] = await Promise.all([
    prisma.queueEntry.count({ where: { userId, status: "waiting" } }),
    prisma.queueGroupMember.count({
      where: { userId, status: { in: ["host", "in"] }, group: { status: "gathering", ...(exceptGroupId ? { id: { not: exceptGroupId } } : {}) } },
    }),
  ]);
  return waiting + seat > 0;
}

/** The host's friends for the "Add friends" list, with a plain reason for anyone who can't come. */
export async function friendsForQueue(hostId: string) {
  const ids = [...(await friendIdsOf(hostId))];
  const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: userSel, orderBy: { name: "asc" } });
  const out = [];
  for (const u of users) {
    const blocker = (await blockerFor(u.id, [hostId])) ?? ((await isBusy(u.id)) ? "busy" : null);
    out.push({ ...u, blocker });
  }
  return out;
}

export type StartGroupResult =
  | { ok: true; groupId: string }
  | JoinError
  | { ok: false; error: "no_friends" | "not_friends" | "too_many" | "friend_blocked" | "age"; friendId?: string; blocker?: FriendBlocker };

/** Host taps "Find my squad" with friends picked: create the group and send the invites. */
export async function createGroup(hostId: string, input: JoinInput, friendIds: string[]): Promise<StartGroupResult> {
  const host = await prisma.user.findUnique({ where: { id: hostId } });
  if (!host || !isAdultBand(host.ageBand)) return { ok: false, error: "age" };
  const ids = [...new Set(friendIds.filter((f) => f !== hostId))];
  if (!ids.length) return { ok: false, error: "no_friends" };
  // There is no group size cap, but at least one slot stays open for someone new.
  if (1 + ids.length >= input.targetSize) return { ok: false, error: "too_many" };
  const mine = await friendIdsOf(hostId);
  const stranger = ids.find((f) => !mine.has(f));
  if (stranger) return { ok: false, error: "not_friends", friendId: stranger };
  // Each friend against the host first (so the error names the friend who can't come), then each other.
  for (const f of ids) {
    const blocker = await blockerFor(f, [hostId]);
    if (blocker) return { ok: false, error: "friend_blocked", friendId: f, blocker };
  }
  for (const [i, f] of ids.entries()) {
    const blocker = await blockerFor(f, ids.slice(i + 1));
    if (blocker) return { ok: false, error: "friend_blocked", friendId: f, blocker };
  }
  const r = await resolveJoin(input);
  if (!r.ok) return r;

  // One queue at a time: drop the host's solo entry and any group they were gathering.
  await prisma.queueEntry.updateMany({ where: { userId: hostId, status: "waiting" }, data: { status: "left" } });
  await cancelGatheringFor(hostId);

  const group = await prisma.queueGroup.create({
    data: {
      hostId,
      mode: r.mode,
      eventId: input.eventId,
      targetPartySize: input.targetSize,
      bucketLandmarkId: r.bucket.id,
      lat: r.lat,
      lng: r.lng,
      locationSource: input.locationSource,
      members: { create: [{ userId: hostId, status: "host", respondedAt: nowDate() }, ...ids.map((userId) => ({ userId }))] },
    },
  });
  publish("queueGroup", { type: "invite", groupId: group.id }, ids);
  publish("badges", {}, ids);
  await scheduleSimAccepts(group.id);
  return { ok: true, groupId: group.id };
}

/** Simulated friends say yes on their own, so the demo works from one phone. */
async function scheduleSimAccepts(groupId: string) {
  const seats = await prisma.queueGroupMember.findMany({ where: { groupId, status: "invited", user: { isSimulated: true } } });
  for (const [i, s] of seats.entries()) {
    const run = () => respondToInvite(s.userId, groupId, true).catch((e) => console.error("[sim accept]", e));
    if (process.env.NODE_ENV === "test") await run();
    else setTimeout(run, SIM_ACCEPT_MS * (i + 1));
  }
}

async function cancelGatheringFor(hostId: string) {
  const open = await prisma.queueGroup.findMany({ where: { hostId, status: "gathering" }, select: { id: true } });
  for (const g of open) await cancelGroup(hostId, g.id);
}

/** Invited friend answers. Accepting re-checks every safety rule against everyone already in. */
export async function respondToInvite(userId: string, groupId: string, accept: boolean) {
  const group = await prisma.queueGroup.findUnique({ where: { id: groupId }, include: { members: true } });
  const seat = group?.members.find((m) => m.userId === userId);
  if (!group || !seat) return { ok: false as const, error: "not_found" as const };
  if (group.status !== "gathering" || seat.status !== "invited") return { ok: false as const, error: "closed" as const };
  if (accept) {
    const others = group.members.filter((m) => m.userId !== userId && (m.status === "host" || m.status === "in")).map((m) => m.userId);
    const blocker = (await blockerFor(userId, others)) ?? ((await isBusy(userId, groupId)) ? "busy" : null);
    if (blocker) return { ok: false as const, error: "blocked" as const, blocker };
  }
  await prisma.queueGroupMember.update({ where: { id: seat.id }, data: { status: accept ? "in" : "declined", respondedAt: nowDate() } });
  notifyGroup(group.members.map((m) => m.userId), groupId);
  return { ok: true as const };
}

/**
 * A friend of the host asks to come along (the friends' queues feature uses this). Allowed while the
 * host is still gathering and a slot is left for someone new; the same safety rules apply.
 */
export async function askToJoin(userId: string, groupId: string) {
  const group = await prisma.queueGroup.findUnique({ where: { id: groupId }, include: { members: true } });
  if (!group || group.status !== "gathering") return { ok: false as const, error: "closed" as const };
  if (!(await friendIdsOf(group.hostId)).has(userId)) return { ok: false as const, error: "not_friends" as const };
  const seat = group.members.find((m) => m.userId === userId);
  if (seat && (seat.status === "in" || seat.status === "host")) return { ok: true as const };
  const going = group.members.filter((m) => m.status === "host" || m.status === "in" || m.status === "invited");
  if (!seat && going.length + 1 >= group.targetPartySize) return { ok: false as const, error: "full" as const };
  const others = group.members.filter((m) => m.status === "host" || m.status === "in").map((m) => m.userId);
  const blocker = (await blockerFor(userId, others)) ?? ((await isBusy(userId, groupId)) ? "busy" : null);
  if (blocker) return { ok: false as const, error: "blocked" as const, blocker };
  await prisma.queueGroupMember.upsert({
    where: { groupId_userId: { groupId, userId } },
    create: { groupId, userId, status: "in", respondedAt: nowDate() },
    update: { status: "in", respondedAt: nowDate() },
  });
  notifyGroup([...group.members.map((m) => m.userId), userId], groupId);
  return { ok: true as const };
}

/** Host starts queuing with whoever is in. Friends who haven't answered are left out. */
export async function startGroup(hostId: string, groupId: string) {
  const group = await prisma.queueGroup.findUnique({ where: { id: groupId }, include: { members: true } });
  if (!group || group.hostId !== hostId) return { ok: false as const, error: "not_found" as const };
  if (group.status !== "gathering") return { ok: false as const, error: "closed" as const };
  const inIds = group.members.filter((m) => m.status === "host" || m.status === "in").map((m) => m.userId);
  if (inIds.length < 2) return { ok: false as const, error: "no_friends" as const };
  // Re-check everyone against everyone (someone may have blocked someone since).
  const people = await loadPeople(prisma, inIds);
  for (let i = 0; i < inIds.length; i++)
    for (let j = i + 1; j < inIds.length; j++)
      if (!pairAllowed(people.get(inIds[i])!, people.get(inIds[j])!)) return { ok: false as const, error: "friend_blocked" as const };

  const at = nowDate();
  const entryIds = await prisma.$transaction(async (tx) => {
    const claimed = await tx.queueGroup.updateMany({ where: { id: groupId, status: "gathering" }, data: { status: "queued", startedAt: at } });
    if (!claimed.count) return null;
    await tx.queueGroupMember.updateMany({ where: { groupId, status: "invited" }, data: { status: "missed" } });
    await tx.queueEntry.updateMany({ where: { userId: { in: inIds }, status: "waiting" }, data: { status: "left" } });
    const ids: string[] = [];
    // Host first, so the host's entry anchors the unit and owns the simulated fill.
    for (const userId of [hostId, ...inIds.filter((u) => u !== hostId)]) {
      const e = await tx.queueEntry.create({
        data: {
          userId,
          mode: group.mode,
          eventId: group.eventId,
          targetPartySize: group.targetPartySize,
          lat: group.lat,
          lng: group.lng,
          bucketLandmarkId: group.bucketLandmarkId,
          joinedAt: at,
          groupId,
        },
      });
      ids.push(e.id);
    }
    return ids;
  });
  if (!entryIds) return { ok: false as const, error: "closed" as const };
  const host = await prisma.user.findUniqueOrThrow({ where: { id: hostId } });
  if (!host.isSimulated) await scheduleSimulatedFill(entryIds[0]);
  ensureTicker();
  publish("queue", { type: "joined", userId: hostId });
  publish("queueGroup", { type: "started", groupId }, group.members.map((m) => m.userId));
  publish("demo", { type: "queue" });
  return { ok: true as const };
}

/** Host cancels before queuing. */
export async function cancelGroup(hostId: string, groupId: string) {
  const group = await prisma.queueGroup.findUnique({ where: { id: groupId }, include: { members: true } });
  if (!group || group.hostId !== hostId) return { ok: false as const, error: "not_found" as const };
  if (group.status !== "gathering") return { ok: false as const, error: "closed" as const };
  await prisma.queueGroup.update({ where: { id: groupId }, data: { status: "cancelled" } });
  notifyGroup(group.members.map((m) => m.userId), groupId);
  return { ok: true as const };
}

/** A friend leaves before the host starts. (Once queuing, leaving is the normal Leave queue.) */
export async function leaveGroup(userId: string, groupId: string) {
  const seat = await prisma.queueGroupMember.findUnique({ where: { groupId_userId: { groupId, userId } }, include: { group: { include: { members: true } } } });
  if (!seat) return { ok: false as const, error: "not_found" as const };
  if (seat.status === "host") return cancelGroup(userId, groupId);
  await prisma.queueGroupMember.update({ where: { id: seat.id }, data: { status: "left", respondedAt: nowDate() } });
  notifyGroup(seat.group.members.map((m) => m.userId), groupId);
  return { ok: true as const };
}

function notifyGroup(userIds: string[], groupId: string) {
  publish("queueGroup", { type: "changed", groupId }, userIds);
  publish("badges", {}, userIds);
}

/** Everything the "Waiting for your friends" and invite screens show. Only members can see it. */
export async function getGroupView(userId: string, groupId: string) {
  const group = await prisma.queueGroup.findUnique({
    where: { id: groupId },
    include: {
      host: { select: userSel },
      members: { include: { user: { select: userSel } }, orderBy: { invitedAt: "asc" } },
    },
  });
  if (!group) return null;
  const me = group.members.find((m) => m.userId === userId);
  if (!me) return null;
  const [event, area] = await Promise.all([
    group.eventId ? prisma.event.findUnique({ where: { id: group.eventId }, select: { id: true, title: true, startsAt: true, venueName: true } }) : null,
    prisma.landmark.findUnique({ where: { id: group.bucketLandmarkId }, select: { name: true } }),
  ]);
  return {
    id: group.id,
    status: group.status as GroupStatus,
    isHost: group.hostId === userId,
    mySeat: me.status as SeatStatus,
    host: group.host,
    mode: group.mode as "events" | "hangout",
    targetSize: group.targetPartySize,
    event: event ? { ...event, startsAt: event.startsAt.toISOString() } : null,
    areaName: area?.name ?? "",
    members: group.members
      .filter((m) => m.status !== "declined" || group.hostId === userId)
      .map((m) => ({ ...m.user, status: m.status as SeatStatus })),
  };
}

/** Open invites for Notifications. */
export async function pendingInvites(userId: string) {
  return prisma.queueGroupMember.findMany({
    where: { userId, status: "invited", group: { status: "gathering" } },
    include: { group: { include: { host: { select: userSel } } } },
    orderBy: { invitedAt: "desc" },
  });
}

/** The group this user is gathering with right now (host or in), if any. */
export async function currentGathering(userId: string) {
  const seat = await prisma.queueGroupMember.findFirst({
    where: { userId, status: { in: ["host", "in"] }, group: { status: "gathering" } },
    orderBy: { invitedAt: "desc" },
  });
  return seat?.groupId ?? null;
}

/** The friends this user is queuing with (or was matched with), for the queue screen and squad found. */
export async function queuingWith(userId: string, groupId: string | null | undefined) {
  if (!groupId) return [];
  const entries = await prisma.queueEntry.findMany({
    where: { groupId, status: { in: ["waiting", "matched"] }, userId: { not: userId } },
    include: { user: { select: userSel } },
  });
  const seen = new Set<string>();
  return entries.filter((e) => !seen.has(e.userId) && seen.add(e.userId)).map((e) => e.user);
}
