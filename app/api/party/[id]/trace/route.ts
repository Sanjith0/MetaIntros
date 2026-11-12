import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTrace } from "@/lib/server/trace";
import { isRevealed } from "@/lib/server/party";
import { getCurrentUserId } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const member = await prisma.partyMember.findFirst({ where: { partyId: id, userId: await getCurrentUserId() }, include: { party: { select: { status: true } } } });
  if (!member) return NextResponse.json({ error: "not found" }, { status: 404 });
  // The trace names people, so it stays hidden until everyone has said "I'm in".
  if (!isRevealed(member.party.status)) return NextResponse.json({ error: "not revealed yet" }, { status: 409 });
  return NextResponse.json(await getTrace(id));
}
