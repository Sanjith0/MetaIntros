import { prisma } from "@/lib/db";
import { label } from "@/lib/agents/describe";

/** A squad is revealed (full names, photos, trace, chat) only once everyone has said "I'm in". */
export const isRevealed = (status: string) => status === "confirmed" || status === "completed";

/** "Reza Ahmadi" → "Reza A." */
export const firstAndInitial = (name: string) => {
  const [f, ...rest] = name.trim().split(/\s+/);
  const last = rest.at(-1);
  return last ? `${f} ${last[0].toUpperCase()}.` : f;
};

export async function getPartyForUser(userId: string, partyId: string) {
  const p = await loadParty(partyId);
  if (!p || !p.members.some((m) => m.userId === userId)) return null;
  if (p.status === "confirming") return maskedForReadyCheck(userId, p);
  // photos are party-scoped: only returned to members, only if the owner opted in
  return { ...p, viewerId: userId, members: p.members.map((m) => ({ ...m, shared: [] as string[], photoUrl: m.photoOptIn ? m.photoUrl : null })) };
}

/**
 * Before everyone accepts, a member sees the others' first name and last initial and what they
 * share with them, and nothing else: no photo, no rationale. Enforced here, not in the UI.
 */
async function maskedForReadyCheck(userId: string, p: NonNullable<Awaited<ReturnType<typeof loadParty>>>) {
  const profiles = await prisma.tasteProfile.findMany({ where: { userId: { in: p.members.map((m) => m.userId) } }, select: { userId: true, interestTags: true } });
  const tags = new Map(profiles.map((t) => [t.userId, (t.interestTags as { tag: string }[]).map((x) => x.tag)]));
  const mine = new Set(tags.get(userId) ?? []);
  return {
    ...p,
    rationale: null,
    viewerId: userId,
    members: p.members.map((m) => ({
      ...m,
      photoUrl: null,
      photoOptIn: false,
      shared: m.userId === userId ? [] : (tags.get(m.userId) ?? []).filter((t) => mine.has(t)).slice(0, 3).map((t) => label(t)),
      user: { ...m.user, name: m.userId === userId ? m.user.name : firstAndInitial(m.user.name) },
    })),
  };
}

function loadParty(partyId: string) {
  return prisma.party.findUnique({
    where: { id: partyId },
    include: {
      members: { include: { user: { select: { id: true, name: true, avatarColor: true, isSimulated: true, isLive: true } } }, orderBy: { joinedAt: "asc" } },
      event: true,
      landmark: true,
      chat: { select: { id: true, archived: true, expiresAt: true } },
    },
  });
}
