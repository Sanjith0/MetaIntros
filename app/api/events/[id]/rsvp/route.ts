import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/server/session";

const Body = z.object({ status: z.enum(["interested", "going"]).nullable() });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "bad body" }, { status: 400 });
  const userId = await getCurrentUserId();
  const ev = await prisma.event.findUnique({ where: { id }, select: { kind: true } });
  if (!ev || ev.kind !== "event") return NextResponse.json({ error: "not found" }, { status: 404 }); // hangouts have no RSVPs
  if (parsed.data.status === null) {
    await prisma.eventRsvp.deleteMany({ where: { eventId: id, userId } });
  } else {
    await prisma.eventRsvp.upsert({
      where: { eventId_userId: { eventId: id, userId } },
      create: { eventId: id, userId, status: parsed.data.status },
      update: { status: parsed.data.status },
    });
  }
  return NextResponse.json({ ok: true, status: parsed.data.status });
}
