import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTrace } from "@/lib/server/trace";
import { getCurrentUserId } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const member = await prisma.partyMember.findFirst({ where: { partyId: id, userId: await getCurrentUserId() } });
  if (!member) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(await getTrace(id));
}
