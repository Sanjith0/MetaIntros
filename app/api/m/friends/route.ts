import { NextResponse } from "next/server";
import { listFriends, listQueueUpFriends, listRequests, listSuggestions } from "@/lib/server/friends";
import { getCurrentUserId } from "@/lib/server/session";
import { listFriendQueues } from "@/lib/server/friendQueues";

export const dynamic = "force-dynamic";

/** Friends as JSON, for the Expo app (mirrors app/(app)/friends/page.tsx). */
export async function GET() {
  const userId = await getCurrentUserId();
  const [friends, requests, queueUp, suggestions, friendQueues] = await Promise.all([listFriends(userId), listRequests(userId), listQueueUpFriends(userId), listSuggestions(userId), listFriendQueues(userId)]);
  const queueOf = new Map(friendQueues.map((q) => [q.friend.id, q.label]));
  return NextResponse.json({
    friends: friends.map((f) => ({ ...f, queueLabel: queueOf.get(f.id) ?? null })),
    requests,
    queueUp,
    suggestions,
  });
}
