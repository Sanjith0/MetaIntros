import { NextResponse } from "next/server";
import { whyForFriendQueue } from "@/lib/server/friendQueues";
import { getCurrentUserId } from "@/lib/server/session";

/** One AI-written line on why a friend's queue might suit you (template if AI is unavailable). */
export async function GET(_req: Request, { params }: { params: Promise<{ entryId: string }> }) {
  const { entryId } = await params;
  const r = await whyForFriendQueue(await getCurrentUserId(), entryId);
  if (!r) return NextResponse.json({ ok: false }, { status: 404 });
  return NextResponse.json({ ok: true, ...r });
}
