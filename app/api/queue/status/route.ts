import { NextResponse } from "next/server";
import { getQueueStatus } from "@/lib/server/queue";
import { getCurrentUserId } from "@/lib/server/session";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getCurrentUserId();
  const status = await getQueueStatus(userId);
  // The event's title, so a client without server rendering (the Expo app) can name the queue.
  const eventId = (status as { eventId?: string | null }).eventId;
  const eventTitle = eventId ? (await prisma.event.findUnique({ where: { id: eventId }, select: { title: true } }))?.title ?? null : null;
  return NextResponse.json({ ...status, eventTitle });
}
