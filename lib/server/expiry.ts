import { prisma } from "@/lib/db";
import { publish } from "./bus";
import { getClockOffsetMs, now as clockNow, setClockOffsetMs } from "./clock";
import { memberIds, postMessage } from "./messages";
import { CHAT_TTL_AFTER_EVENT_MS } from "./squadChat";

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

/** Demo: jump the clock to just past the expiry of the user's latest squad, then sweep. */
export async function fastForward(userId: string) {
  const m = await prisma.partyMember.findFirst({
    where: { userId, party: { status: { in: ["confirmed", "completed"] }, eventId: { not: null } } },
    orderBy: { joinedAt: "desc" },
    include: { party: { include: { event: true } } },
  });
  if (!m?.party.event) return { ok: false as const, error: "no squad" };
  const target = m.party.event.endsAt.getTime() + CHAT_TTL_AFTER_EVENT_MS + 60_000;
  const offset = Math.max(await getClockOffsetMs(), target - Date.now());
  await setClockOffsetMs(offset);
  const archived = await sweepExpiredChats(new Date(Date.now() + offset));
  publish("demo", { type: "fast-forward" });
  return { ok: true as const, partyId: m.party.id, archived, now: new Date(Date.now() + offset).toISOString() };
}
