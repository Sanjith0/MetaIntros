import { prisma } from "@/lib/db";

/**
 * Companion conversations between squad members. They are written by the Companion engine
 * (lib/server/rooms.ts) when a squad forms, and always labeled as AI simulations.
 */
export async function getPreChatsFor(partyId: string, ownerId: string) {
  const rows = await prisma.preChat.findMany({ where: { partyId, OR: [{ userAId: ownerId }, { userBId: ownerId }] } });
  return rows.map((r) => ({
    otherId: r.userAId === ownerId ? r.userBId : r.userAId,
    meIsA: r.userAId === ownerId,
    transcript: r.transcript as { speaker: "A" | "B"; text: string }[],
    sparks: r.sparks as string[],
    simulated: r.simulated,
  }));
}
