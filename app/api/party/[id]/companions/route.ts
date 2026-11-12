import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/server/session";

export const dynamic = "force-dynamic";

/** How this member's squad was decided, as this member may see it. Members only. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getCurrentUserId();
  const party = await prisma.party.findUnique({ where: { id }, include: { members: { include: { user: { select: { id: true, name: true, avatarColor: true } } } } } });
  if (!party?.members.some((m) => m.userId === me)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const row = await prisma.companionRecap.findUnique({ where: { partyId_userId: { partyId: id, userId: me } } });
  if (!row) return NextResponse.json({ pending: true }); // not written yet, or a squad formed without the Companion engine
  const recap = row.data as { numbers: { similarityPick: { id: string }[]; passedOver: { id: string }[] } };
  const extra = [...recap.numbers.similarityPick.map((x) => x.id), ...recap.numbers.passedOver.map((x) => x.id)];
  const others = await prisma.user.findMany({ where: { id: { in: extra } }, select: { id: true, name: true, avatarColor: true } });
  const people = Object.fromEntries([...party.members.map((m) => m.user), ...others].map((u) => [u.id, { name: u.name, avatarColor: u.avatarColor }]));
  return NextResponse.json({ me, people, recap: row.data });
}
