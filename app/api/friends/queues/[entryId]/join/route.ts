import { NextResponse } from "next/server";
import { joinFriendQueue } from "@/lib/server/friendQueues";
import { getCurrentUserId } from "@/lib/server/session";

/**
 * Join a friend's queue. Default: together (added to their group → same squad). Body {separate: true}:
 * the same queue, matched on your own. 404 if you can't see that queue.
 */
export async function POST(req: Request, { params }: { params: Promise<{ entryId: string }> }) {
  const { entryId } = await params;
  const body = (await req.json().catch(() => ({}))) as { separate?: boolean };
  const r = await joinFriendQueue(await getCurrentUserId(), entryId, { separate: body.separate === true });
  const status = r.ok ? 200 : r.error === "not_visible" ? 404 : r.error === "age" ? 403 : 400;
  return NextResponse.json(r, { status });
}
