import { QueueScreen } from "@/components/queue/QueueScreen";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/server/session";

export default async function QueuePage() {
  const userId = await getCurrentUserId();
  const entry = await prisma.queueEntry.findFirst({
    where: { userId, status: { in: ["waiting", "matched"] } },
    orderBy: { joinedAt: "desc" },
    select: { event: { select: { title: true } } },
  });
  return <QueueScreen meId={userId} eventTitle={entry?.event?.title ?? null} />;
}
