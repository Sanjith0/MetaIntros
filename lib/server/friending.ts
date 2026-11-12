import { prisma } from "@/lib/db";
import { normalizePair } from "@/lib/domain/enums";
import { publish } from "./bus";

/**
 * Accept/decline an incoming request. A Friendship is created only on acceptance by the
 * recipient (mutual consent: the sender already opted in by sending).
 */
export async function respondToRequest(userId: string, requestId: string, accept: boolean) {
  const r = await prisma.friendRequest.findUnique({ where: { id: requestId }, include: { party: true } });
  if (!r || r.toId !== userId || r.status !== "pending") return { ok: false as const, error: "not found" };
  if (!accept) {
    await prisma.friendRequest.update({ where: { id: r.id }, data: { status: "declined" } });
    return { ok: true as const, friendship: null };
  }
  const f = await createFriendship(r.fromId, r.toId, r.party ? { eventId: r.party.eventId, partyId: r.party.id } : undefined);
  await prisma.friendRequest.update({ where: { id: r.id }, data: { status: "accepted" } });
  return { ok: true as const, friendship: f };
}

export async function createFriendship(a: string, b: string, queueUp?: { eventId: string | null; partyId: string; sharedNote?: string | null }) {
  const [x, y] = normalizePair(a, b);
  const f = await prisma.friendship.upsert({
    where: { userAId_userBId: { userAId: x, userBId: y } },
    create: {
      userAId: x,
      userBId: y,
      source: queueUp ? "queue_up" : "existing",
      metAtEventId: queueUp?.eventId ?? null,
      sharedNote: queueUp?.sharedNote ?? null,
    },
    update: {},
  });
  publish("badges", {}, [a, b]);
  publish("friends", {}, [a, b]);
  return f;
}
