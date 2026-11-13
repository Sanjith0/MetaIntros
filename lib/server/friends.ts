import { personaFrom } from "@/lib/profile/persona";
import { prisma } from "@/lib/db";
import { friendIdsOf } from "./events";
import { suggestFriends } from "@/lib/match/friendSafety";

const userSel = { id: true, name: true, avatarColor: true, neighborhood: true } as const;

export async function listFriends(userId: string) {
  const mine = await friendIdsOf(userId);
  const users = await prisma.user.findMany({ where: { id: { in: [...mine] } }, select: { ...userSel, rawGraph: true }, orderBy: { name: "asc" } });
  const out = [];
  for (const { rawGraph, ...u } of users) {
    const theirs = await friendIdsOf(u.id);
    out.push({ ...u, work: personaFrom(rawGraph).work, mutual: [...theirs].filter((x) => mine.has(x)).length });
  }
  return out;
}

export async function listRequests(userId: string) {
  const [incoming, outgoing] = await Promise.all([
    prisma.friendRequest.findMany({ where: { toId: userId, status: "pending" }, include: { from: { select: userSel } }, orderBy: { createdAt: "desc" } }),
    prisma.friendRequest.findMany({ where: { fromId: userId, status: "pending" }, include: { to: { select: userSel } }, orderBy: { createdAt: "desc" } }),
  ]);
  return { incoming, outgoing };
}

export async function listQueueUpFriends(userId: string) {
  const fs = await prisma.friendship.findMany({
    where: { source: "queue_up", OR: [{ userAId: userId }, { userBId: userId }] },
    include: { userA: { select: userSel }, userB: { select: userSel }, metAtEvent: { select: { id: true, title: true, startsAt: true } } },
    orderBy: { createdAt: "desc" },
  });
  return fs.map((f) => ({
    id: f.id,
    friend: f.userAId === userId ? f.userB : f.userA,
    event: f.metAtEvent,
    sharedNote: f.sharedNote,
    createdAt: f.createdAt,
  }));
}

/** People you may know (safety-filtered: no minor/adult crossing, no blocks). */
export async function listSuggestions(userId: string, limit = 6) {
  const users = await prisma.user.findMany({ select: { id: true, ageBand: true } });
  const blocks = await prisma.block.findMany();
  const people = new Map(users.map((u) => [u.id, { id: u.id, ageBand: u.ageBand, blocked: new Set<string>() }]));
  for (const b of blocks) {
    people.get(b.blockerId)?.blocked.add(b.blockedId);
    people.get(b.blockedId)?.blocked.add(b.blockerId);
  }
  const fs = await prisma.friendship.findMany({ select: { userAId: true, userBId: true } });
  const friends = new Map<string, Set<string>>();
  for (const f of fs) {
    (friends.get(f.userAId) ?? friends.set(f.userAId, new Set()).get(f.userAId)!).add(f.userBId);
    (friends.get(f.userBId) ?? friends.set(f.userBId, new Set()).get(f.userBId)!).add(f.userAId);
  }
  const mates = await prisma.partyMember.findMany({ where: { party: { status: "completed", members: { some: { userId } } } }, select: { userId: true } });
  const me = people.get(userId);
  if (!me) return [];
  const sug = suggestFriends(me, people, friends, new Set(mates.map((m) => m.userId)), limit);
  const info = await prisma.user.findMany({ where: { id: { in: sug.map((s) => s.id) } }, select: userSel });
  return sug.map((s) => ({ ...s, user: info.find((i) => i.id === s.id)! }));
}
