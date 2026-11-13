import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/server/session";
import { personaFrom } from "@/lib/profile/persona";
import { VOCAB_BY_TAG } from "@/lib/graph/vocabulary";

export const dynamic = "force-dynamic";

/** Profile as JSON, for the Expo app (mirrors app/(app)/profile/page.tsx, without the Companion brief). */
export async function GET() {
  const me = await getCurrentUser();
  const [tp, friends, squads] = await Promise.all([
    prisma.tasteProfile.findUnique({ where: { userId: me.id } }),
    prisma.friendship.count({ where: { OR: [{ userAId: me.id }, { userBId: me.id }] } }),
    prisma.partyMember.count({ where: { userId: me.id, party: { status: { in: ["confirmed", "completed"] } } } }),
  ]);
  const persona = personaFrom(me.rawGraph);
  const tags = ((tp?.interestTags ?? []) as { tag: string }[]).slice(0, 10).map((t) => VOCAB_BY_TAG.get(t.tag)?.label ?? t.tag);
  return NextResponse.json({
    name: me.name, avatarColor: me.avatarColor, friends, squads, about: persona.about ?? null, work: persona.work ?? null,
    hometown: persona.hometown ?? null, neighborhood: me.neighborhood ?? null, ageBand: me.ageBand, isLive: me.isLive,
    shareQueue: me.queueVisibility === "friends", interests: tags,
  });
}
