import { prisma } from "@/lib/db";

export async function getPartyForUser(userId: string, partyId: string) {
  const p = await prisma.party.findUnique({
    where: { id: partyId },
    include: {
      members: { include: { user: { select: { id: true, name: true, avatarColor: true, isSimulated: true, isLive: true } } }, orderBy: { joinedAt: "asc" } },
      event: true,
      landmark: true,
      chat: { select: { id: true, archived: true, expiresAt: true } },
    },
  });
  if (!p || !p.members.some((m) => m.userId === userId)) return null;
  // photos are party-scoped: only returned to members, only if the owner opted in
  return { ...p, members: p.members.map((m) => ({ ...m, photoUrl: m.photoOptIn ? m.photoUrl : null })) };
}
