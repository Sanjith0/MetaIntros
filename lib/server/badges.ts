import { prisma } from "@/lib/db";

export type Tab = "home" | "events" | "friends" | "chats" | "profile";
export const TABS: Tab[] = ["home", "events", "friends", "chats", "profile"];

const key = (userId: string, tab: Tab) => `tabSeen:${userId}:${tab}`;

export async function getTabSeen(userId: string, tab: Tab): Promise<Date> {
  const row = await prisma.appSetting.findUnique({ where: { key: key(userId, tab) } });
  return row ? new Date(row.value) : new Date(0);
}

export async function markTabSeen(userId: string, tab: Tab, at = new Date()) {
  await prisma.appSetting.upsert({
    where: { key: key(userId, tab) },
    create: { key: key(userId, tab), value: at.toISOString() },
    update: { value: at.toISOString() },
  });
}

/** Unread counts per chat for a user (messages from others after lastReadAt). */
export async function unreadByChat(userId: string): Promise<Map<string, number>> {
  const memberships = await prisma.chatMember.findMany({ where: { userId }, select: { chatId: true, lastReadAt: true } });
  const out = new Map<string, number>();
  for (const m of memberships) {
    const n = await prisma.chatMessage.count({
      where: { chatId: m.chatId, createdAt: { gt: m.lastReadAt }, OR: [{ senderId: null }, { senderId: { not: userId } }] },
    });
    out.set(m.chatId, n);
  }
  return out;
}

/**
 * Tab badges = new activity since the tab was last opened.
 * chats: chats with unread messages newer than the last Chats-tab visit.
 * friends: incoming requests + Queue Up friendships since the last Friends-tab visit.
 */
export async function getBadges(userId: string): Promise<Record<Tab, number>> {
  const [chatsSeen, friendsSeen, eventsSeen] = await Promise.all([
    getTabSeen(userId, "chats"),
    getTabSeen(userId, "friends"),
    getTabSeen(userId, "events"),
  ]);
  const memberships = await prisma.chatMember.findMany({ where: { userId }, select: { chatId: true, lastReadAt: true } });
  let chats = 0;
  for (const m of memberships) {
    const since = m.lastReadAt > chatsSeen ? m.lastReadAt : chatsSeen;
    const n = await prisma.chatMessage.count({
      where: { chatId: m.chatId, createdAt: { gt: since }, OR: [{ senderId: null }, { senderId: { not: userId } }] },
    });
    if (n > 0) chats++;
  }
  const requests = await prisma.friendRequest.count({ where: { toId: userId, status: "pending", createdAt: { gt: friendsSeen } } });
  const newFriends = await prisma.friendship.count({
    where: { source: "queue_up", createdAt: { gt: friendsSeen }, OR: [{ userAId: userId }, { userBId: userId }] },
  });
  const squads = await prisma.partyMember.count({ where: { userId, party: { status: "confirmed", createdAt: { gt: eventsSeen } } } });
  return { home: 0, events: squads, friends: requests + newFriends, chats, profile: 0 };
}
