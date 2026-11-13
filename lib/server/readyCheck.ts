/**
 * Ready check ("I'm in"), game match-accept style.
 *
 * When the pipeline has a safe squad and an event (or a planned hangout), the party goes to
 * "confirming" instead of straight to "confirmed". Every real member sees the squad and the plan
 * and taps "I'm in" or "Not for me". Simulated members accept on their own.
 *
 * - Everyone accepts → the party is confirmed and the squad chat, AI host and talk cards start.
 * - Someone declines, or the deadline passes → the party is cancelled. Whoever declined (or never
 *   answered) leaves the queue. Every real member who did accept goes back into the queue with
 *   their original join time, so they keep their place in line, and simulated fillers are
 *   re-staged for them. A hangout planned for the squad is dropped.
 */
import { prisma } from "@/lib/db";
import { nowMs } from "@/lib/clock";
import { publish } from "./bus";
import { getSetting } from "./settings";
import { afterPartyConfirmed } from "./hooks";
import { leaveGroup, markGroupsMatched } from "./groups";

/** Ten minutes: long enough to notice a phone buzz (docs/SYNTHESIS.md §5). The demo can shorten it. */
export const DEFAULT_ACCEPT_WINDOW_MS = 10 * 60_000;

export async function acceptWindowMs() {
  const v = Number(await getSetting("acceptWindowMs", String(DEFAULT_ACCEPT_WINDOW_MS)));
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_ACCEPT_WINDOW_MS;
}

/** Start the ready check for a party that already has its event. Confirms at once if nobody real is in it. */
export async function startReadyCheck(partyId: string, eventId: string) {
  const at = new Date(nowMs());
  const members = await prisma.partyMember.findMany({ where: { partyId }, include: { user: { select: { isSimulated: true } } } });
  const sims = members.filter((m) => m.user.isSimulated).map((m) => m.id);
  await prisma.$transaction([
    prisma.partyMember.updateMany({ where: { id: { in: sims } }, data: { acceptedAt: at } }),
    prisma.party.update({ where: { id: partyId }, data: { eventId, status: "confirming", acceptBy: new Date(at.getTime() + (await acceptWindowMs())) } }),
  ]);
  const realIds = members.filter((m) => !m.user.isSimulated).map((m) => m.userId);
  if (!realIds.length) return finalizeParty(partyId);
  publish("party", { type: "ready_check", partyId, eventId }, realIds);
  publish("demo", { type: "party", partyId });
  return "confirming" as const;
}

/** Everyone's in: confirm the party and open the squad chat. Runs once even if called twice. */
async function finalizeParty(partyId: string) {
  const r = await prisma.party.updateMany({ where: { id: partyId, status: "confirming" }, data: { status: "confirmed", acceptBy: null } });
  if (!r.count) return "confirmed" as const;
  await markGroupsMatched(partyId); // queue together: these groups are done
  await afterPartyConfirmed(partyId);
  const party = await prisma.party.findUniqueOrThrow({ where: { id: partyId }, include: { members: true } });
  const userIds = party.members.map((m) => m.userId);
  publish("party", { type: "formed", partyId, eventId: party.eventId }, userIds);
  publish("badges", {}, userIds);
  publish("demo", { type: "party", partyId });
  return "confirmed" as const;
}

export type ReadyCheckResult =
  | { ok: true; status: "confirming" | "confirmed" | "cancelled" }
  | { ok: false; error: "not_found" | "expired" | "closed" };

async function openCheck(userId: string, partyId: string) {
  const party = await prisma.party.findUnique({ where: { id: partyId }, include: { members: true } });
  const me = party?.members.find((m) => m.userId === userId);
  if (!party || !me) return { error: "not_found" as const, party: null };
  if (party.status !== "confirming") return { error: "closed" as const, party };
  return { error: null, party, me };
}

/** "I'm in". */
export async function acceptParty(userId: string, partyId: string): Promise<ReadyCheckResult> {
  const c = await openCheck(userId, partyId);
  if (c.error) {
    // A repeat tap after the squad already confirmed is fine; anything else is too late.
    if (c.party?.status === "confirmed") return { ok: true, status: "confirmed" };
    return { ok: false, error: c.error };
  }
  if (c.party.acceptBy && c.party.acceptBy.getTime() <= nowMs()) {
    await sweepReadyChecks();
    return { ok: false, error: "expired" };
  }
  if (!c.me.acceptedAt) await prisma.partyMember.update({ where: { id: c.me.id }, data: { acceptedAt: new Date(nowMs()) } });
  const waitingOn = await prisma.partyMember.count({ where: { partyId, acceptedAt: null } });
  if (waitingOn > 0) {
    publish("party", { type: "accepted", partyId, userId }, c.party.members.map((m) => m.userId));
    return { ok: true, status: "confirming" };
  }
  return { ok: true, status: await finalizeParty(partyId) };
}

/** "Not for me": this user leaves; everyone else who's real goes back into the queue. */
export async function declineParty(userId: string, partyId: string): Promise<ReadyCheckResult> {
  const c = await openCheck(userId, partyId);
  if (c.error) return { ok: false, error: c.error };
  await dissolve(partyId, [userId], "declined");
  return { ok: true, status: "cancelled" };
}

/** Drop anyone who hasn't answered by the deadline. Called by the matchmaking ticker. */
export async function sweepReadyChecks(at = nowMs()): Promise<string[]> {
  const due = await prisma.party.findMany({ where: { status: "confirming", acceptBy: { lte: new Date(at) } }, include: { members: true } });
  for (const p of due) await dissolve(p.id, p.members.filter((m) => !m.acceptedAt).map((m) => m.userId), "timeout");
  return due.map((p) => p.id);
}

async function dissolve(partyId: string, dropped: string[], reason: "declined" | "timeout") {
  const won = await prisma.party.updateMany({ where: { id: partyId, status: "confirming" }, data: { status: "cancelled", acceptBy: null } });
  if (!won.count) return;
  const party = await prisma.party.findUniqueOrThrow({
    where: { id: partyId },
    include: { event: true, members: { include: { user: { select: { isSimulated: true } } } }, queueEntries: true },
  });
  const drop = new Set(dropped);
  const requeue = party.members.filter((m) => !m.user.isSimulated && !drop.has(m.userId)).map((m) => m.userId);
  const entries = party.queueEntries;
  const back = entries.filter((e) => requeue.includes(e.userId)).map((e) => e.id);
  await prisma.$transaction([
    // Decliners and no-shows leave; simulated fillers leave too (fresh ones are staged below).
    prisma.queueEntry.updateMany({ where: { partyId, id: { notIn: back } }, data: { status: "left" } }),
    // Real people who said yes keep their original joinedAt, so they're first in line again.
    prisma.queueEntry.updateMany({ where: { id: { in: back } }, data: { status: "waiting", partyId: null, matchedAt: null } }),
  ]);
  if (party.event?.kind === "hangout") await prisma.event.delete({ where: { id: party.event.id } }).catch(() => {});
  // Queue together: whoever dropped out leaves their group; the rest stay grouped (their entries keep groupId).
  for (const u of dropped) await leaveGroup(u, { quiet: true }).catch(() => {});
  const { scheduleSimulatedFill, ensureTicker } = await import("./queue");
  for (const id of back) await scheduleSimulatedFill(id).catch(() => {});
  if (back.length) ensureTicker();
  const realIds = party.members.filter((m) => !m.user.isSimulated).map((m) => m.userId);
  publish("party", { type: "cancelled", partyId, reason }, realIds);
  publish("queue", { type: "requeued" }, requeue);
  publish("demo", { type: "queue" });
}
