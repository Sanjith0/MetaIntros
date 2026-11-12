import type { PrismaClient } from "@prisma/client";
import type { SocialStyle, SourcedItem, TasteProfileData, WeightedTag } from "./builder";

export interface Person {
  id: string;
  name: string;
  ageBand: string;
  gender: string | null;
  womenOnlyParty: boolean;
  homeLat: number | null;
  homeLng: number | null;
  isSimulated: boolean;
  isLive: boolean;
  avatarColor: string;
  profile: TasteProfileData;
  friends: Set<string>;
  blocked: Set<string>; // either direction
}

/** Load matchable people (profile + availability + friends + blocks) from the DB. */
export async function loadPeople(prisma: PrismaClient, ids?: string[]): Promise<Map<string, Person>> {
  const users = await prisma.user.findMany({
    where: ids ? { id: { in: ids } } : undefined,
    include: { tasteProfile: true, availability: true },
  });
  const idSet = new Set(users.map((u) => u.id));
  const friendships = await prisma.friendship.findMany({
    where: ids ? { OR: [{ userAId: { in: ids } }, { userBId: { in: ids } }] } : undefined,
    select: { userAId: true, userBId: true },
  });
  const blocks = await prisma.block.findMany({
    where: ids ? { OR: [{ blockerId: { in: ids } }, { blockedId: { in: ids } }] } : undefined,
  });
  const out = new Map<string, Person>();
  for (const u of users) {
    if (!u.tasteProfile) continue;
    const tp = u.tasteProfile;
    out.set(u.id, {
      id: u.id,
      name: u.name,
      ageBand: u.ageBand,
      gender: u.gender,
      womenOnlyParty: u.womenOnlyParty,
      homeLat: u.homeLat,
      homeLng: u.homeLng,
      isSimulated: u.isSimulated,
      isLive: u.isLive,
      avatarColor: u.avatarColor,
      friends: new Set(),
      blocked: new Set(),
      profile: {
        userId: u.id,
        likes: tp.likes as unknown as SourcedItem[],
        dislikes: tp.dislikes as unknown as SourcedItem[],
        groups: tp.groups as unknown as SourcedItem[],
        music: tp.music as unknown as SourcedItem[],
        eventHistory: tp.eventHistory as unknown as SourcedItem[],
        interestTags: tp.interestTags as unknown as WeightedTag[],
        embedding: tp.embedding as unknown as number[],
        socialStyle: tp.socialStyle as SocialStyle,
        availability: u.availability.map((a) => ({ dayOfWeek: a.dayOfWeek, startMin: a.startMin, endMin: a.endMin })),
      },
    });
  }
  for (const f of friendships) {
    out.get(f.userAId)?.friends.add(f.userBId);
    out.get(f.userBId)?.friends.add(f.userAId);
  }
  for (const b of blocks) {
    out.get(b.blockerId)?.blocked.add(b.blockedId);
    out.get(b.blockedId)?.blocked.add(b.blockerId);
  }
  void idSet;
  return out;
}
