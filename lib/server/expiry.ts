import { prisma } from "@/lib/db";
import { publish } from "./bus";
import { advanceClockTo, now as clockNow } from "./clock";
import { memberIds, postMessage } from "./messages";

export const ARCHIVE_NOTICE = "This squad chat has ended. Want to stay in touch? Add your squad as friends.";


/** Archive every squad chat whose expiry (24h after the event) has passed. Idempotent. */
export async function sweepExpiredChats(at?: Date): Promise<string[]> {
  const now = at ?? (await clockNow());
  const due = await prisma.chat.findMany({ where: { type: "squad", archived: false, expiresAt: { lte: now } } });
  for (const c of due) {
    const r = await prisma.chat.updateMany({ where: { id: c.id, archived: false }, data: { archived: true } });
    if (!r.count) continue;
    await postMessage(c.id, null, ARCHIVE_NOTICE, "system");
    if (c.partyId) {
      await prisma.party.update({ where: { id: c.partyId }, data: { status: "completed" } });
      // party-scoped photos don't outlive the squad
      await prisma.partyMember.updateMany({ where: { partyId: c.partyId }, data: { photoUrl: null, photoOptIn: false } });
    }
    const members = await memberIds(c.id);
    publish("chat-archived", { chatId: c.id, partyId: c.partyId }, members);
    publish("badges", {}, members);
  }
  return due.map((c) => c.id);
}

/**
 * Demo Fast-forward: end the next event to finish — for everyone. Among all active squads (confirmed, chat
 * still open), pick the one whose event ends soonest (an already-finished event comes first). The global
 * clock moves forward (never back) to just after it ends, and every squad at that event has its chat ended
 * now (read-only + "add your squad as friends") instead of 24h later. Pressing again ends the next one, so
 * the clock never skips past an event that hasn't been wrapped up.
 */
export async function fastForward(_userId?: string) {
  const party = await prisma.party.findFirst({
    where: { status: "confirmed", event: { isNot: null } },
    orderBy: [{ event: { endsAt: "asc" } }, { createdAt: "asc" }],
    include: { event: true },
  });
  if (!party?.event) return { ok: false as const, error: "no squad" };
  const ev = party.event;
  const now = await advanceClockTo(new Date(ev.endsAt.getTime() + 60_000));
  await prisma.chat.updateMany({ where: { type: "squad", archived: false, party: { eventId: ev.id } }, data: { expiresAt: now } });
  const archived = await sweepExpiredChats(now);
  publish("demo", { type: "fast-forward" });
  return { ok: true as const, partyId: party.id, eventId: ev.id, eventTitle: ev.kind === "hangout" ? "the hangout" : ev.title, squads: archived.length, archived, now: now.toISOString() };
}
