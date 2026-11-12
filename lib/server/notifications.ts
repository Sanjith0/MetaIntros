import { prisma } from "@/lib/db";
import { fmtEventWhen } from "@/lib/format";
import { listFriendQueues } from "./friendQueues";

/**
 * The Notifications tab, derived from data Queue Up already keeps (no new table): squads formed, chats
 * that ended, friend requests, friendships made through Queue Up, and upcoming events you're interested in.
 */
export type NotificationKind = "squad" | "chat_ended" | "request" | "met" | "reminder" | "friend_queue" | "group_invite";

export interface NotificationItem {
  id: string;
  kind: NotificationKind;
  /** the person or thing pictured */
  avatar: { name: string; color: string };
  /** text with the subject's name first; `bold` is the leading name to emphasise */
  bold: string;
  text: string;
  href: string;
  at: Date;
}

const DAY = 24 * 3600_000;

export async function listNotifications(userId: string, now: Date): Promise<NotificationItem[]> {
  const [memberships, requests, friendships, rsvps, friendQueues, groupInvites] = await Promise.all([
    prisma.partyMember.findMany({
      where: { userId, party: { status: { in: ["confirmed", "completed"] } } },
      include: { party: { include: { event: true, chat: { select: { id: true, archived: true, expiresAt: true } }, members: true } } },
    }),
    prisma.friendRequest.findMany({ where: { toId: userId, status: "pending" }, include: { from: true } }),
    prisma.friendship.findMany({
      where: { source: "queue_up", OR: [{ userAId: userId }, { userBId: userId }] },
      include: { userA: true, userB: true, metAtEvent: true },
    }),
    prisma.eventRsvp.findMany({
      where: { userId, status: { in: ["interested", "going"] }, event: { kind: "event", startsAt: { gt: now, lt: new Date(now.getTime() + 3 * DAY) } } },
      include: { event: true },
    }),
    listFriendQueues(userId),
    prisma.queueGroupMember.findMany({ where: { userId, status: "invited", group: { status: { in: ["open", "queued"] } } }, include: { group: true } }),
  ]);

  const out: NotificationItem[] = [];
  for (const m of memberships) {
    const p = m.party;
    if (!p.event) continue;
    out.push({
      id: `squad-${p.id}`,
      kind: "squad",
      avatar: { name: "Queue Up", color: p.event.coverColor },
      bold: "Your squad is ready.",
      text: `${p.members.length} people are going to ${p.event.title} together.`,
      href: `/squad/${p.id}`,
      at: p.createdAt,
    });
    if (p.chat?.archived) {
      out.push({
        id: `ended-${p.id}`,
        kind: "chat_ended",
        avatar: { name: "Queue Up", color: p.event.coverColor },
        bold: "Your squad chat has ended.",
        text: "Add the people you'd like to see again. You only become friends if you both say yes.",
        href: `/squad/${p.id}/connect`,
        at: p.chat.expiresAt ?? p.event.endsAt,
      });
    }
  }
  for (const r of requests) {
    out.push({
      id: `req-${r.id}`,
      kind: "request",
      avatar: { name: r.from.name, color: r.from.avatarColor },
      bold: r.from.name,
      text: r.partyId ? "sent you a friend request. You met through Queue Up." : "sent you a friend request.",
      href: "/friends?tab=requests",
      at: r.createdAt,
    });
  }
  for (const f of friendships) {
    const other = f.userAId === userId ? f.userB : f.userA;
    out.push({
      id: `met-${f.id}`,
      kind: "met",
      avatar: { name: other.name, color: other.avatarColor },
      bold: other.name,
      text: f.metAtEvent ? `and you are now friends. You met at ${f.metAtEvent.title}.` : "and you are now friends.",
      href: "/friends?tab=queueup",
      at: f.createdAt,
    });
  }
  for (const r of rsvps) {
    out.push({
      id: `rem-${r.id}`,
      kind: "reminder",
      avatar: { name: r.event.title, color: r.event.coverColor },
      bold: r.event.title,
      text: `is coming up ${fmtEventWhen(r.event.startsAt)}.`,
      href: `/events/${r.event.id}`,
      at: new Date(Math.min(now.getTime(), r.event.startsAt.getTime() - 2 * DAY)),
    });
  }
  // Friends who chose to share that they're queuing (opt-in, filtered by canSeeQueue)
  for (const q of friendQueues) {
    if (q.state !== "waiting") continue;
    out.push({
      id: `fq-${q.entryId}`,
      kind: "friend_queue",
      avatar: { name: q.friend.name, color: q.friend.avatarColor },
      bold: q.friend.name,
      text: `is ${q.label.charAt(0).toLowerCase()}${q.label.slice(1)}. Queue up too?`,
      href: "/events#friends-queuing",
      at: new Date(q.since),
    });
  }
  // Queue together: a friend invited you into their group
  if (groupInvites.length) {
    const hosts = await prisma.user.findMany({ where: { id: { in: groupInvites.map((i) => i.group.hostId) } }, select: { id: true, name: true, avatarColor: true } });
    for (const inv of groupInvites) {
      const h = hosts.find((x) => x.id === inv.group.hostId);
      if (!h) continue;
      out.push({ id: `gi-${inv.id}`, kind: "group_invite", avatar: { name: h.name, color: h.avatarColor }, bold: h.name, text: "invited you to queue together. You'd be in the same squad.", href: "/queue/start", at: inv.createdAt });
    }
  }
  return out.sort((a, b) => b.at.getTime() - a.at.getTime());
}

export function unreadCount(items: NotificationItem[], seenAt: Date) {
  return items.filter((n) => n.at > seenAt && n.kind !== "reminder").length;
}
