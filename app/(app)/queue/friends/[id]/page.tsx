import { notFound } from "next/navigation";
import { WaitingForFriends } from "@/components/queue/WaitingForFriends";
import { getGroupView } from "@/lib/server/queueGroups";
import { getCurrentUserId } from "@/lib/server/session";

export const dynamic = "force-dynamic";

/** Queue with friends: the host waits for friends to say yes; invited friends answer here. */
export default async function QueueWithFriendsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  const view = await getGroupView(userId, id);
  if (!view) notFound();
  return <WaitingForFriends initial={view} meId={userId} />;
}
