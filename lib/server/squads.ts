import { prisma } from "@/lib/db";
import { publish } from "./bus";
import { postMessage } from "./messages";
import { squadName } from "./squadChat";

/**
 * Pairs already in a squad together right now (forming, waiting on "I'm in", or confirmed), as
 * "a|b" keys, for these people. Matching keeps them apart: you can be in more than one squad, and
 * each new one should be new people, not the same faces (simulated fillers included).
 */
export async function activeSquadPairs(userIds: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  if (!userIds.length) return out;
  const parties = await prisma.party.findMany({
    where: { status: { in: ["forming", "confirming", "confirmed"] }, members: { some: { userId: { in: userIds } } } },
    select: { members: { select: { userId: true } } },
  });
  for (const p of parties) {
    const ids = p.members.map((m) => m.userId);
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) out.add(ids[i] < ids[j] ? `${ids[i]}|${ids[j]}` : `${ids[j]}|${ids[i]}`);
  }
  return out;
}

/** Event ids where the user has a confirmed squad. */
export async function squadEventIds(userId: string): Promise<Set<string>> {
  const ms = await prisma.partyMember.findMany({
    where: { userId, party: { status: { in: ["confirmed", "completed"] }, eventId: { not: null } } },
    select: { party: { select: { eventId: true } } },
  });
  return new Set(ms.map((m) => m.party.eventId!).filter(Boolean));
}

export async function getSquadForEvent(userId: string, eventId: string) {
  const m = await prisma.partyMember.findFirst({
    where: { userId, party: { eventId, status: { in: ["confirmed", "completed"] } } },
    include: {
      party: {
        include: {
          members: { include: { user: { select: { id: true, name: true, avatarColor: true } } } },
          chat: { select: { id: true } },
        },
      },
    },
  });
  if (!m) return null;
  return {
    partyId: m.party.id,
    chatId: m.party.chat?.id ?? null,
    members: m.party.members.map((x) => ({ ...x.user, photoUrl: null })),
  };
}
export type SquadSummary = NonNullable<Awaited<ReturnType<typeof getSquadForEvent>>>;

export interface ActiveSquad {
  partyId: string;
  chatId: string | null;
  name: string;
  eventId: string;
  eventTitle: string;
  startsAt: string;
  venueName: string;
  hangout: boolean;
  faces: { id: string; name: string; avatarColor: string }[];
}

/**
 * Every squad you're in right now (confirmed, chat still open), soonest first. You can be in more
 * than one: a squad for Friday's show and a new hangout on Sunday, say.
 */
export async function listActiveSquads(userId: string): Promise<ActiveSquad[]> {
  const ms = await prisma.partyMember.findMany({
    where: { userId, party: { status: "confirmed", eventId: { not: null } } },
    include: {
      party: {
        include: {
          event: { select: { id: true, title: true, startsAt: true, venueName: true, kind: true } },
          chat: { select: { id: true, archived: true } },
          members: { include: { user: { select: { id: true, name: true, avatarColor: true } } }, orderBy: { joinedAt: "asc" } },
        },
      },
    },
  });
  return ms
    .filter((m) => m.party.event && !m.party.chat?.archived)
    .map((m) => {
      const ev = m.party.event!;
      return {
        partyId: m.party.id,
        chatId: m.party.chat?.id ?? null,
        name: squadName(ev.title),
        eventId: ev.id,
        eventTitle: ev.title,
        startsAt: ev.startsAt.toISOString(),
        venueName: ev.venueName,
        hangout: ev.kind === "hangout",
        faces: m.party.members.map((x) => x.user).filter((u) => u.id !== userId),
      };
    })
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export type LeaveSquadResult = { ok: true } | { ok: false; error: "not_found" | "not_open" };

/**
 * Leave a squad you're in. You leave its chat and its plan; the others see "{first name} left the
 * squad" and nothing else. Only while the squad is on (confirmed, chat open): during the ready check
 * "Not for me" does this, and an ended squad has nothing left to leave.
 */
export async function leaveSquad(userId: string, partyId: string): Promise<LeaveSquadResult> {
  const p = await prisma.party.findUnique({
    where: { id: partyId },
    include: { members: { select: { userId: true } }, chat: { select: { id: true, archived: true } } },
  });
  if (!p || !p.members.some((m) => m.userId === userId)) return { ok: false, error: "not_found" };
  if (p.status !== "confirmed" || p.chat?.archived) return { ok: false, error: "not_open" };
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
  await prisma.$transaction([
    prisma.partyMember.deleteMany({ where: { partyId, userId } }),
    ...(p.chat ? [prisma.chatMember.deleteMany({ where: { chatId: p.chat.id, userId } })] : []),
    prisma.queueEntry.updateMany({ where: { partyId, userId }, data: { status: "left" } }),
  ]);
  if (p.chat) await postMessage(p.chat.id, null, `${(me?.name ?? "Someone").split(/\s+/)[0]} left the squad.`, "system");
  const everyone = p.members.map((m) => m.userId);
  publish("party", { type: "left", partyId }, everyone);
  publish("badges", {}, [userId]);
  publish("demo", { type: "queue" });
  return { ok: true };
}
