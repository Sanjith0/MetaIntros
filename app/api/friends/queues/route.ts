import { NextResponse } from "next/server";
import { listFriendQueues } from "@/lib/server/friendQueues";
import { getCurrentUserId } from "@/lib/server/session";

/** Friends' queues you may see (opt-in by them; filtered on the server). ?eventId= narrows to one event. */
export async function GET(req: Request) {
  const eventId = new URL(req.url).searchParams.get("eventId") ?? undefined;
  return NextResponse.json({ queues: await listFriendQueues(await getCurrentUserId(), { eventId }) });
}
