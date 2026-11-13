/**
 * Queue together — like a party in a game. A host gathers people (friends by invite, anyone by short code),
 * then starts the queue for everyone at once. The matcher (lib/match/engine.ts) treats the group as one unit:
 * it fills the remaining spots with compatible strangers and never splits the group.
 *
 * Safety is enforced here and again in the engine: everyone in a group must pass pairAllowed with everyone
 * else (age band, women-only, blocks in either direction), and Link is 18+.
 */
import { prisma } from "@/lib/db";
import { pairAllowed } from "@/lib/match/safety";
import { loadPeople } from "@/lib/profile/load";
import { publish } from "./bus";
import { friendIdsOf } from "./events";
import { getSetting } from "./settings";
import { isAdultBand } from "./signup";

/** A group plus at least one stranger: the most people who can queue together in a squad of `size`. */
export const maxGroupFor = (squadSize: number) => squadSize - 1;
/** While gathering (size not chosen yet): the largest squad offered is 6. */
export const MAX_OPEN_GROUP = 5;

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I/L

export type GroupError = "not_found" | "full" | "not_friends" | "unsafe" | "age" | "already_queued" | "not_host" | "self" | "not_waiting";

export interface GroupView {
  id: string;
  code: string;
  status: string;
  isHost: boolean;
  host: { id: string; name: string };
  members: { id: string; name: string; avatarColor: string; status: string; isSimulated: boolean }[];
  /** spots left for people joining this group */
  room: number;
  /** set once the group is in the queue */
  targetSize: number | null;
}

export interface GroupInvite {
  groupId: string;
  host: { id: string; name: string; avatarColor: string };
  joined: number;
}

async function newCode(): Promise<string> {
  for (;;) {
    let c = "";
    for (let i = 0; i < 4; i++) c += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    if (!(await prisma.queueGroup.findUnique({ where: { code: c } }))) return c;
  }
}

const joinedIds = (g: { members: { userId: string; status: string }[] }) => g.members.filter((m) => m.status === "joined").map((m) => m.userId);

/** The open or queued group this user is in (joined), if any. */
async function activeMembership(userId: string) {
  return prisma.queueGroupMember.findFirst({
    where: { userId, status: "joined", group: { status: { in: ["open", "queued"] } } },
    include: { group: { include: { members: true, entries: { where: { status: "waiting" } } } } },
    orderBy: { createdAt: "desc" },
  });
}

/** Room left: while queued it's the squad size minus one (at least one stranger), else MAX_OPEN_GROUP. */
function roomLeft(g: { status: string; members: { status: string; userId: string }[]; entries: { targetPartySize: number }[] }) {
  const cap = g.status === "queued" && g.entries[0] ? maxGroupFor(g.entries[0].targetPartySize) : MAX_OPEN_GROUP;
  return Math.max(0, cap - joinedIds(g).length);
}

/** Can `candidateId` be in a squad with every current member? (code-enforced, same rules as the matcher) */
export async function safeWithGroup(candidateId: string, memberIds: string[]): Promise<boolean> {
  const people = await loadPeople(prisma, [candidateId, ...memberIds]);
  const c = people.get(candidateId);
  if (!c || !isAdultBand(c.ageBand)) return false;
  return memberIds.every((id) => {
    const m = people.get(id);
    return Boolean(m && pairAllowed(c, m));
  });
}

async function view(groupId: string, viewerId: string): Promise<GroupView | null> {
  const g = await prisma.queueGroup.findUnique({ where: { id: groupId }, include: { members: true, entries: { where: { status: "waiting" } } } });
  if (!g) return null;
  const users = await prisma.user.findMany({ where: { id: { in: g.members.map((m) => m.userId) } }, select: { id: true, name: true, avatarColor: true, isSimulated: true } });
  const byId = new Map(users.map((u) => [u.id, u]));
  const host = byId.get(g.hostId);
  return {
    id: g.id,
    code: g.code,
    status: g.status,
    isHost: g.hostId === viewerId,
    host: { id: g.hostId, name: host?.name ?? "" },
    members: g.members
      .filter((m) => m.status === "joined" || m.status === "invited")
      .map((m) => ({ id: m.userId, name: byId.get(m.userId)?.name ?? "", avatarColor: byId.get(m.userId)?.avatarColor ?? "", status: m.status, isSimulated: byId.get(m.userId)?.isSimulated ?? false })),
    room: roomLeft(g),
    targetSize: g.entries[0]?.targetPartySize ?? null,
  };
}

function notify(groupId: string, userIds: string[], type: string) {
  publish("group", { type, groupId }, userIds);
  publish("badges", {}, userIds);
}

/** Your group (if any) and invites waiting for you. */
export async function myGroupState(userId: string): Promise<{ group: GroupView | null; invites: GroupInvite[] }> {
  const m = await activeMembership(userId);
  const invites = await prisma.queueGroupMember.findMany({
    where: { userId, status: "invited", group: { status: { in: ["open", "queued"] } } },
    include: { group: { include: { members: true } } },
    orderBy: { createdAt: "desc" },
  });
  const hosts = await prisma.user.findMany({ where: { id: { in: invites.map((i) => i.group.hostId) } }, select: { id: true, name: true, avatarColor: true } });
  return {
    group: m ? await view(m.groupId, userId) : null,
    invites: invites.map((i) => ({ groupId: i.groupId, host: hosts.find((h) => h.id === i.group.hostId)!, joined: joinedIds(i.group).length })).filter((i) => i.host),
  };
}

/** Your open group as host, creating one (with a fresh code) if you don't have one. */
export async function getOrCreateGroup(hostId: string): Promise<{ ok: true; group: GroupView } | { ok: false; error: GroupError }> {
  const me = await prisma.user.findUnique({ where: { id: hostId }, select: { ageBand: true } });
  if (!me || !isAdultBand(me.ageBand)) return { ok: false, error: "age" };
  const m = await activeMembership(hostId);
  if (m) {
    if (m.group.status === "queued") return { ok: false, error: "already_queued" };
    return { ok: true, group: (await view(m.groupId, hostId))! };
  }
  const g = await prisma.queueGroup.create({ data: { hostId, code: await newCode(), members: { create: { userId: hostId, status: "joined", via: "host" } } } });
  return { ok: true, group: (await view(g.id, hostId))! };
}

/** Add someone as a joined member (after every check) and, if the group is already queuing, queue them too. */
async function addMember(groupId: string, userId: string, via: string, invitedById: string | null): Promise<{ ok: true } | { ok: false; error: GroupError }> {
  const g = await prisma.queueGroup.findUnique({ where: { id: groupId }, include: { members: true, entries: { where: { status: "waiting" } } } });
  if (!g || !["open", "queued"].includes(g.status)) return { ok: false, error: "not_found" };
  const members = joinedIds(g);
  if (members.includes(userId)) return { ok: true };
  if (roomLeft(g) <= 0) return { ok: false, error: "full" };
  if (!(await safeWithGroup(userId, members))) return { ok: false, error: "unsafe" };

  // one group at a time: leave any other group, and any queue you were in on your own
  await leaveGroup(userId, { quiet: true });
  await prisma.queueGroupMember.upsert({
    where: { groupId_userId: { groupId, userId } },
    create: { groupId, userId, status: "joined", via, invitedById },
    update: { status: "joined", via },
  });
  if (g.status === "queued" && g.entries[0]) {
    const host = g.entries.find((e) => e.userId === g.hostId) ?? g.entries[0];
    await prisma.queueEntry.updateMany({ where: { userId, status: "waiting" }, data: { status: "left" } });
    const u = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { queueVisibility: true } });
    const created = await prisma.queueEntry.create({
      data: {
        userId, groupId, mode: host.mode, eventId: host.eventId, targetPartySize: host.targetPartySize,
        lat: host.lat, lng: host.lng, bucketLandmarkId: host.bucketLandmarkId,
        visibleToFriends: u.queueVisibility === "friends", viaFriendId: via === "friend_queue" ? g.hostId : null,
      },
    });
    // a parked (demo) friend's group starts matching once someone real joins it
    const joiner = await prisma.user.findUnique({ where: { id: userId }, select: { isSimulated: true } });
    if (!joiner?.isSimulated) {
      await prisma.queueEntry.updateMany({ where: { groupId, status: "waiting", parked: true }, data: { parked: false } });
      // same as queuing yourself: demo fillers top up the squad, and the matcher runs (lazy import: queue.ts imports this file)
      const q = await import("./queue");
      await q.scheduleSimulatedFill(created.id);
      q.ensureTicker();
    }
    publish("queue", { type: "joined", userId });
    publish("demo", { type: "queue" });
  }
  notify(groupId, [...members, userId], "member-joined");
  return { ok: true };
}

/** Invite a friend (friends only; they must be safe with everyone already in). Simulated friends accept on their own. */
export async function inviteFriend(hostId: string, friendId: string): Promise<{ ok: true; group: GroupView } | { ok: false; error: GroupError }> {
  if (hostId === friendId) return { ok: false, error: "self" };
  const r = await getOrCreateGroup(hostId);
  if (!r.ok) return r;
  if (!r.group.isHost) return { ok: false, error: "not_host" };
  if (!(await friendIdsOf(hostId)).has(friendId)) return { ok: false, error: "not_friends" };
  if (r.group.room <= 0) return { ok: false, error: "full" };
  if (!(await safeWithGroup(friendId, r.group.members.filter((m) => m.status === "joined").map((m) => m.id)))) return { ok: false, error: "unsafe" };
  await prisma.queueGroupMember.upsert({
    where: { groupId_userId: { groupId: r.group.id, userId: friendId } },
    create: { groupId: r.group.id, userId: friendId, status: "invited", via: "invite", invitedById: hostId },
    update: { status: "invited", invitedById: hostId },
  });
  notify(r.group.id, [friendId, hostId], "invited");
  const friend = await prisma.user.findUnique({ where: { id: friendId }, select: { isSimulated: true } });
  if (friend?.isSimulated) await scheduleSimulatedAccept(r.group.id, friendId);
  return { ok: true, group: (await view(r.group.id, hostId))! };
}

/** Demo: seeded friends accept an invite after a short delay (real people tap Join themselves). */
async function scheduleSimulatedAccept(groupId: string, userId: string) {
  const delay = Number(await getSetting("simAcceptMs", "1500"));
  const run = () => respondToInvite(userId, groupId, true).catch(() => {});
  if (process.env.NODE_ENV === "test" && delay === 0) await run();
  else setTimeout(run, delay);
}

export async function respondToInvite(userId: string, groupId: string, accept: boolean): Promise<{ ok: true } | { ok: false; error: GroupError }> {
  const inv = await prisma.queueGroupMember.findUnique({ where: { groupId_userId: { groupId, userId } } });
  if (!inv || inv.status !== "invited") return { ok: false, error: "not_found" };
  if (!accept) {
    await prisma.queueGroupMember.update({ where: { id: inv.id }, data: { status: "declined" } });
    const g = await prisma.queueGroup.findUnique({ where: { id: groupId }, select: { hostId: true } });
    notify(groupId, [userId, ...(g ? [g.hostId] : [])], "declined");
    return { ok: true };
  }
  return addMember(groupId, userId, "invite", inv.invitedById);
}

/** Join a group with its short code (no friendship needed, e.g. people meeting at the demo). */
export async function joinByCode(userId: string, code: string): Promise<{ ok: true; group: GroupView } | { ok: false; error: GroupError }> {
  const g = await prisma.queueGroup.findUnique({ where: { code: code.trim().toUpperCase() } });
  if (!g || !["open", "queued"].includes(g.status)) return { ok: false, error: "not_found" };
  if (g.hostId === userId) return { ok: false, error: "self" };
  const r = await addMember(g.id, userId, "code", null);
  if (!r.ok) return r;
  return { ok: true, group: (await view(g.id, userId))! };
}

/**
 * "Join" a friend's queue: you're added to their group (created on the fly if they queued alone), so you
 * land in the same squad. The caller has already checked you may see their queue (canSeeQueue).
 */
export async function joinFriendsGroup(userId: string, ownerEntryId: string): Promise<{ ok: true } | { ok: false; error: GroupError }> {
  const entry = await prisma.queueEntry.findUnique({ where: { id: ownerEntryId } });
  if (!entry || entry.status !== "waiting") return { ok: false, error: "not_waiting" };
  let groupId = entry.groupId;
  if (!groupId) {
    const g = await prisma.queueGroup.create({
      data: { hostId: entry.userId, code: await newCode(), status: "queued", members: { create: { userId: entry.userId, status: "joined", via: "host" } } },
    });
    await prisma.queueEntry.update({ where: { id: entry.id }, data: { groupId: g.id } });
    groupId = g.id;
  }
  return addMember(groupId, userId, "friend_queue", entry.userId);
}

/** Leave your group (and its queue, if it's queuing). An open group whose host leaves is closed. */
export async function leaveGroup(userId: string, opts: { quiet?: boolean } = {}) {
  const m = await activeMembership(userId);
  if (!m) return;
  await prisma.queueGroupMember.update({ where: { id: m.id }, data: { status: "left" } });
  const rest = joinedIds(m.group).filter((id) => id !== userId);
  if ((m.group.status === "open" && m.group.hostId === userId) || rest.length === 0) {
    await prisma.queueGroup.update({ where: { id: m.groupId }, data: { status: "closed" } });
  }
  if (m.group.status === "queued") {
    await prisma.queueEntry.updateMany({ where: { userId, groupId: m.groupId, status: "waiting" }, data: { status: "left" } });
  }
  if (!opts.quiet) notify(m.groupId, [...rest, userId], "member-left");
}

/**
 * Called when the host queues (lib/server/queue.ts joinQueue): everyone who joined gets the same queue entry
 * settings and the group's id; pending invites lapse. Returns the member user ids that were queued.
 */
export async function startGroupQueue(hostId: string, hostEntryId: string): Promise<string[]> {
  const m = await activeMembership(hostId);
  if (!m || m.group.hostId !== hostId || m.group.status !== "open") return [];
  const host = await prisma.queueEntry.findUniqueOrThrow({ where: { id: hostEntryId } });
  // host + others ≤ size − 1, so every squad has at least one new person
  const others = joinedIds(m.group).filter((id) => id !== hostId).slice(0, maxGroupFor(host.targetPartySize) - 1);
  const safe: string[] = [];
  for (const id of others) if (await safeWithGroup(id, [hostId, ...safe])) safe.push(id);
  await prisma.queueEntry.update({ where: { id: host.id }, data: { groupId: m.groupId } });
  for (const id of safe) {
    await prisma.queueEntry.updateMany({ where: { userId: id, status: "waiting" }, data: { status: "left" } });
    const u = await prisma.user.findUniqueOrThrow({ where: { id }, select: { queueVisibility: true } });
    await prisma.queueEntry.create({
      data: {
        userId: id, groupId: m.groupId, mode: host.mode, eventId: host.eventId, targetPartySize: host.targetPartySize,
        lat: host.lat, lng: host.lng, bucketLandmarkId: host.bucketLandmarkId, visibleToFriends: u.queueVisibility === "friends",
      },
    });
  }
  await prisma.queueGroupMember.updateMany({ where: { groupId: m.groupId, status: "invited" }, data: { status: "lapsed" } });
  await prisma.queueGroupMember.updateMany({ where: { groupId: m.groupId, status: "joined", userId: { notIn: [hostId, ...safe] } }, data: { status: "left" } });
  await prisma.queueGroup.update({ where: { id: m.groupId }, data: { status: "queued" } });
  notify(m.groupId, [hostId, ...safe], "queued");
  return safe;
}

/** After a squad is confirmed: groups whose entries landed in it are done. */
export async function markGroupsMatched(partyId: string) {
  await prisma.queueGroup.updateMany({ where: { status: "queued", entries: { some: { partyId } } }, data: { status: "matched" } });
}

/** Names of the other people in your queue-together group (for the queue screen and "how we matched you"). */
export async function groupmates(userId: string, groupId: string | null): Promise<{ id: string; name: string; avatarColor: string }[]> {
  if (!groupId) return [];
  const entries = await prisma.queueEntry.findMany({ where: { groupId, status: { in: ["waiting", "matched"] }, userId: { not: userId } }, include: { user: { select: { id: true, name: true, avatarColor: true } } } });
  const seen = new Set<string>();
  return entries.map((e) => e.user).filter((u) => !seen.has(u.id) && seen.add(u.id));
}
