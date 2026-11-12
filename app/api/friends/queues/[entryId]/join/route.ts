import { NextResponse } from "next/server";
import { joinFriendQueue } from "@/lib/server/friendQueues";
import { getCurrentUserId } from "@/lib/server/session";

/** "Queue up too": join the same queue as a friend. 404 if you can't see that queue. */
export async function POST(_req: Request, { params }: { params: Promise<{ entryId: string }> }) {
  const { entryId } = await params;
  const r = await joinFriendQueue(await getCurrentUserId(), entryId);
  const status = r.ok ? 200 : r.error === "not_visible" ? 404 : r.error === "age" ? 403 : 400;
  return NextResponse.json(r, { status });
}
