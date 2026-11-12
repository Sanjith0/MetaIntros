import { prisma } from "@/lib/db";

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
