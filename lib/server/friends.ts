import { prisma } from "@/lib/db";
import { friendIdsOf } from "./events";

const userSel = { id: true, name: true, avatarColor: true, neighborhood: true } as const;

export async function listFriends(userId: string) {
  const mine = await friendIdsOf(userId);
  const users = await prisma.user.findMany({ where: { id: { in: [...mine] } }, select: userSel, orderBy: { name: "asc" } });
  const out = [];
  for (const u of users) {
    const theirs = await friendIdsOf(u.id);
    out.push({ ...u, mutual: [...theirs].filter((x) => mine.has(x)).length });
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
