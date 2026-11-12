import { prisma } from "@/lib/db";
import { getQueueStatus } from "./queue";
import { squadName } from "./squadChat";

/**
 * The one Queue Up status card (Events tab top, and the event page it concerns). It moves through
 * waiting → ready → at the venue → after, and always offers exactly one next action.
 */
export type StatusCard =
  | {
      state: "waiting";
      eventId: string | null;
      title: string;
      mode: "events" | "hangout";
      found: number;
      targetSize: number;
      waitedMs: number;
      bucketName: string;
      faces: { id: string; name: string; avatarColor: string }[];
      action: { label: string; href: string };
    }
  | {
      /** Ready check: a squad was found and is waiting on "I'm in" */
      state: "accept";
      partyId: string;
      eventId: string;
      title: string;
      accepted: boolean;
      inCount: number;
      size: number;
      acceptBy: string;
      action: { label: string; href: string };
    }
  | {
      state: "ready" | "venue" | "after";
      partyId: string;
      eventId: string;
      title: string;
      squadName: string;
      startsAt: string;
      venueName: string;
      faces: { id: string; name: string; avatarColor: string }[];
      checkedIn: boolean;
      action: { label: string; href: string };
    };

const HOUR = 3600_000;
/** "At the venue" opens an hour before doors and lasts until the event ends. */
export const VENUE_WINDOW_BEFORE_MS = HOUR;
/** The after card stays for three days, or until you've handled every squadmate. */
export const AFTER_CARD_MS = 72 * HOUR;

export function phaseFor(startsAt: Date, endsAt: Date, archived: boolean, now: Date): "ready" | "venue" | "after" {
  if (archived || now >= endsAt) return "after";
  if (now.getTime() >= startsAt.getTime() - VENUE_WINDOW_BEFORE_MS) return "venue";
  return "ready";
}

/**
 * @param eventId when set, only a card about this event is returned (event page); otherwise the most
 *   relevant card overall (Events tab).
 */
export async function getStatusCard(userId: string, now: Date, eventId?: string): Promise<StatusCard | null> {
  const q = await getQueueStatus(userId);
  if (q.state === "waiting" && (!eventId || q.eventId === eventId)) {
    const ev = q.eventId ? await prisma.event.findUnique({ where: { id: q.eventId }, select: { title: true } }) : null;
    return {
      state: "waiting",
      eventId: q.eventId ?? null,
      title: ev?.title ?? (q.mode === "hangout" ? "A new hangout" : "Any event this weekend"),
      mode: q.mode ?? "events",
      found: Math.min(q.found ?? 1, q.targetSize ?? 6),
      targetSize: q.targetSize ?? 6,
      waitedMs: q.waitedMs ?? 0,
      bucketName: q.bucketName ?? "",
      faces: q.foundUsers ?? [],
      action: { label: "View queue", href: "/queue" },
    };
  }

  if (q.state === "matched" && q.partyId) {
    const p = await prisma.party.findUnique({ where: { id: q.partyId }, include: { event: { select: { id: true, title: true } }, members: { select: { userId: true, acceptedAt: true } } } });
    if (p?.status === "confirming" && p.event && p.acceptBy && (!eventId || p.event.id === eventId)) {
      const accepted = Boolean(p.members.find((m) => m.userId === userId)?.acceptedAt);
      return {
        state: "accept",
        partyId: p.id,
        eventId: p.event.id,
        title: p.event.title,
        accepted,
        inCount: p.members.filter((m) => m.acceptedAt).length,
        size: p.members.length,
        acceptBy: p.acceptBy.toISOString(),
        action: { label: accepted ? "View squad" : "Are you in?", href: "/queue" },
      };
    }
  }

  const ms = await prisma.partyMember.findMany({
    where: { userId, party: { status: { in: ["confirmed", "completed"] }, eventId: eventId ?? { not: null } } },
    include: {
      party: {
        include: {
          event: true,
          chat: { select: { id: true, archived: true } },
          members: { include: { user: { select: { id: true, name: true, avatarColor: true } } }, orderBy: { joinedAt: "asc" } },
          friendRequests: { where: { fromId: userId } },
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });

  for (const m of ms) {
    const p = m.party;
    const ev = p.event;
    if (!ev) continue;
    const phase = phaseFor(ev.startsAt, ev.endsAt, Boolean(p.chat?.archived), now);
    const others = p.members.filter((x) => x.userId !== userId);
    if (phase === "after") {
      const handled = p.friendRequests.length >= others.length;
      const stale = now.getTime() - ev.endsAt.getTime() > AFTER_CARD_MS;
      if ((handled || stale) && !eventId) continue;
    }
    const base = {
      partyId: p.id,
      eventId: ev.id,
      title: ev.title,
      squadName: squadName(ev.title),
      startsAt: ev.startsAt.toISOString(),
      venueName: ev.venueName,
      faces: p.members.map((x) => x.user),
      checkedIn: Boolean(m.checkedInAt),
    };
    if (phase === "ready")
      return { ...base, state: "ready", action: p.chat ? { label: "Open squad chat", href: `/chats/${p.chat.id}` } : { label: "See your squad", href: `/squad/${p.id}` } };
    if (phase === "venue")
      return {
        ...base,
        state: "venue",
        action: m.checkedInAt ? { label: "Find each other", href: `/squad/${p.id}?tab=find` } : { label: "I'm here", href: `/squad/${p.id}?tab=find` },
      };
    return { ...base, state: "after", action: { label: "Add your squad as friends", href: `/squad/${p.id}/connect` } };
  }
  return null;
}
