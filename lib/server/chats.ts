import { prisma } from "@/lib/db";

export interface InboxRow {
  id: string;
  type: string;
  title: string;
  avatar: { name: string; color: string };
  members: { id: string; name: string; avatarColor: string }[];
  lastMessage: string | null;
  lastSender: string | null;
  lastMessageAt: Date;
  unread: number;
  archived: boolean;
  expiresAt: Date | null;
  event: { id: string; title: string; startsAt: Date; endsAt: Date } | null;
}

/** Inbox ordering: active squad chats pinned on top, then most-recent activity. */
export function sortInbox<T extends Pick<InboxRow, "type" | "archived" | "lastMessageAt">>(rows: T[]): T[] {
  const pinned = (r: T) => (r.type === "squad" && !r.archived ? 0 : 1);
  return [...rows].sort((a, b) => pinned(a) - pinned(b) || b.lastMessageAt.getTime() - a.lastMessageAt.getTime());
}

export async function listInbox(userId: string): Promise<InboxRow[]> {
  const memberships = await prisma.chatMember.findMany({
    where: { userId },
    include: {
      chat: {
        include: {
          members: { include: { user: { select: { id: true, name: true, avatarColor: true } } } },
          messages: { orderBy: { createdAt: "desc" }, take: 1, include: { sender: { select: { name: true } } } },
          event: { select: { id: true, title: true, startsAt: true, endsAt: true } },
        },
      },
    },
  });
  const rows: InboxRow[] = [];
  for (const m of memberships) {
    const c = m.chat;
    const others = c.members.map((x) => x.user).filter((u) => u.id !== userId);
    const unread = await prisma.chatMessage.count({
      where: { chatId: c.id, createdAt: { gt: m.lastReadAt }, OR: [{ senderId: null }, { senderId: { not: userId } }] },
    });
    const last = c.messages[0];
    const title = c.type === "direct" ? (others[0]?.name ?? "Chat") : (c.title ?? others.map((o) => o.name.split(" ")[0]).join(", "));
    rows.push({
      id: c.id,
      type: c.type,
      title,
      avatar: c.type === "direct" && others[0] ? { name: others[0].name, color: others[0].avatarColor } : { name: title, color: c.type === "squad" ? "#7c3aed" : "#65676b" },
      members: c.members.map((x) => x.user),
      lastMessage: last?.body ?? null,
      lastSender: last ? (last.senderId === userId ? "You" : last.kind === "host" ? "Queue Up Host" : (last.sender?.name.split(" ")[0] ?? null)) : null,
      lastMessageAt: c.lastMessageAt,
      unread,
      archived: c.archived,
      expiresAt: c.expiresAt,
      event: c.event,
    });
  }
  return sortInbox(rows);
}

export async function getChatForUser(userId: string, chatId: string) {
  const member = await prisma.chatMember.findUnique({ where: { chatId_userId: { chatId, userId } } });
  if (!member) return null;
  return prisma.chat.findUnique({
    where: { id: chatId },
    include: {
      members: { include: { user: { select: { id: true, name: true, avatarColor: true } } } },
      messages: { orderBy: { createdAt: "asc" }, include: { sender: { select: { id: true, name: true, avatarColor: true } } } },
      event: true,
      party: { include: { landmark: true, members: { include: { user: { select: { id: true, name: true, avatarColor: true } } } } } },
    },
  });
}

export async function markChatRead(userId: string, chatId: string, at: Date) {
  await prisma.chatMember.updateMany({ where: { chatId, userId }, data: { lastReadAt: at } });
}
