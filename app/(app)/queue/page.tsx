import { redirect } from "next/navigation";
import { QueueScreen } from "@/components/queue/QueueScreen";
import { prisma } from "@/lib/db";
import { currentGathering } from "@/lib/server/queueGroups";
import { getCurrentUserId } from "@/lib/server/session";

export default async function QueuePage() {
  const userId = await getCurrentUserId();
  const entry = await prisma.queueEntry.findFirst({
    where: { userId, status: { in: ["waiting", "matched"] } },
    orderBy: { joinedAt: "desc" },
    select: { status: true, event: { select: { title: true } } },
  });
  // Queue with friends: still waiting for friends to answer → that screen, not an empty queue.
  if (entry?.status !== "waiting") {
    const gathering = await currentGathering(userId);
    if (gathering) redirect(`/queue/friends/${gathering}`);
  }
  return <QueueScreen meId={userId} eventTitle={entry?.event?.title ?? null} />;
}
