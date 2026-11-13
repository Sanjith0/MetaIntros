import { prisma } from "@/lib/db";
import { tick } from "@/lib/server/queue";
import { acceptParty } from "@/lib/server/readyCheck";

/**
 * One matchmaking pass, then every real member taps "I'm in" on the ready check, so the squad is
 * confirmed (chat, host, talk cards) the way it was before the ready check existed. Tests that
 * are about the ready check itself call tick() directly.
 */
export async function tickAndAccept(): Promise<number> {
  const formed = await tick();
  const pending = await prisma.partyMember.findMany({ where: { acceptedAt: null, party: { status: "confirming" } } });
  for (const m of pending) await acceptParty(m.userId, m.partyId);
  return formed;
}
