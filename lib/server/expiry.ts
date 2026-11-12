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
 * Demo Fast-forward: end the user's current squad event — for everyone. The global clock moves
 * forward (never back) to just after the event ends, so every phone, timestamp and countdown
 * agrees; then every squad at that event has its chat ended now (archive + "add your squad as
 * friends") instead of 24h later. Other events are untouched and stay aligned with the clock.
 */
export async function fastForward(userId: string) {
  const m = await prisma.partyMember.findFirst({
    where: { userId, party: { status: { in: ["confirmed", "completed"] }, eventId: { not: null } } },
    orderBy: { joinedAt: "desc" },
    include: { party: { include: { event: true } } },
  });
  if (!m?.party.event) return { ok: false as const, error: "no squad" };
  const ev = m.party.event;
  const now = await advanceClockTo(new Date(ev.endsAt.getTime() + 60_000));
  await prisma.chat.updateMany({ where: { type: "squad", archived: false, party: { eventId: ev.id } }, data: { expiresAt: now } });
  const archived = await sweepExpiredChats(now);
  publish("demo", { type: "fast-forward" });
  return { ok: true as const, partyId: m.party.id, eventId: ev.id, archived, now: now.toISOString() };
}
