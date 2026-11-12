import { prisma } from "@/lib/db";
import { normalizePair } from "@/lib/domain/enums";
import { friendAllowed } from "@/lib/match/friendSafety";
import { label } from "@/lib/agents/describe";
import type { CardContent } from "@/lib/cards/claims";
import type { WeightedTag } from "@/lib/profile/builder";
import { publish } from "./bus";
import { getSetting } from "./settings";

async function subject(id: string) {
  const u = await prisma.user.findUnique({ where: { id }, include: { blocksMade: true, blocksReceived: true } });
  if (!u) return null;
  return { id, ageBand: u.ageBand, isSimulated: u.isSimulated, blocked: new Set([...u.blocksMade.map((b) => b.blockedId), ...u.blocksReceived.map((b) => b.blockerId)]) };
}

async function areFriends(a: string, b: string) {
  const [x, y] = normalizePair(a, b);
  return Boolean(await prisma.friendship.findUnique({ where: { userAId_userBId: { userAId: x, userBId: y } } }));
}

/** Top shared interest for the "Met through Queue Up" note: from the talk card, else profiles. */
export async function sharedNoteFor(partyId: string, a: string, b: string): Promise<string | null> {
  const card = await prisma.talkCard.findUnique({ where: { partyId_ownerId_subjectId: { partyId, ownerId: a, subjectId: b } } });
  const claim = (card?.content as unknown as CardContent | undefined)?.claims.find((c) => c.kind === "shared_interest");
  const fromCard = claim?.text.match(/into (.+?) —/)?.[1];
  if (fromCard) return fromCard;
  const [ta, tb] = await Promise.all([a, b].map((id) => prisma.tasteProfile.findUnique({ where: { userId: id } })));
  const bt = new Set(((tb?.interestTags ?? []) as unknown as WeightedTag[]).map((t) => t.tag));
  const t = ((ta?.interestTags ?? []) as unknown as WeightedTag[]).find((x) => bt.has(x.tag));
  return t ? label(t.tag).toLowerCase() : null;
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

/**
 * Accept/decline an incoming request. A Friendship is created only when the recipient accepts
 * (the sender opted in by sending) — i.e. only on mutual consent.
 */
export async function respondToRequest(userId: string, requestId: string, accept: boolean) {
  const r = await prisma.friendRequest.findUnique({ where: { id: requestId }, include: { party: true } });
  if (!r || r.toId !== userId || r.status !== "pending") return { ok: false as const, error: "not found" };
  if (!accept) {
    await prisma.friendRequest.update({ where: { id: r.id }, data: { status: "declined" } });
    publish("friends", {}, [r.fromId, r.toId]);
    return { ok: true as const, friendship: null };
  }
  const [a, b] = await Promise.all([subject(r.fromId), subject(r.toId)]);
  if (!a || !b || !friendAllowed(a, b)) return { ok: false as const, error: "not allowed" };
  const f = await createFriendship(r.fromId, r.toId, r.party ? { eventId: r.party.eventId, partyId: r.party.id, sharedNote: await sharedNoteFor(r.party.id, r.toId, r.fromId) } : undefined);
  await prisma.friendRequest.update({ where: { id: r.id }, data: { status: "accepted" } });
  await prisma.friendRequest.updateMany({ where: { fromId: r.toId, toId: r.fromId, status: "pending" }, data: { status: "accepted" } });
  return { ok: true as const, friendship: f };
}

export type SquadFriendState = "add" | "requested" | "incoming" | "friends" | "unavailable";

/** "Add friend" from a finished squad. Becomes a friendship only once the other side also opts in. */
export async function sendSquadRequest(fromId: string, toId: string, partyId: string) {
  const party = await prisma.party.findUnique({ where: { id: partyId }, include: { members: true, chat: true } });
  if (!party || !party.members.some((m) => m.userId === fromId) || !party.members.some((m) => m.userId === toId)) return { ok: false as const, error: "not_in_party" };
  if (party.status !== "completed" && !party.chat?.archived) return { ok: false as const, error: "event_not_over" };
  const [a, b] = await Promise.all([subject(fromId), subject(toId)]);
  if (!a || !b || !friendAllowed(a, b)) return { ok: false as const, error: "not_allowed" };
  if (await areFriends(fromId, toId)) return { ok: true as const, state: "friends" as SquadFriendState };

  const reverse = await prisma.friendRequest.findUnique({ where: { fromId_toId: { fromId: toId, toId: fromId } } });
  if (reverse?.status === "pending") {
    await respondToRequest(fromId, reverse.id, true); // they already asked → mutual
    return { ok: true as const, state: "friends" as SquadFriendState };
  }
  const req = await prisma.friendRequest.upsert({
    where: { fromId_toId: { fromId, toId } },
    create: { fromId, toId, partyId },
    update: { status: "pending", partyId },
  });
  publish("badges", {}, [toId]);
  publish("friends", {}, [fromId, toId]);
  if (b.isSimulated) await scheduleSimulatedAccept(req.id, toId).catch(() => {});
  return { ok: true as const, state: "requested" as SquadFriendState, requestId: req.id };
}

/** Demo: simulated squadmates accept after a short delay (live users must tap themselves). */
async function scheduleSimulatedAccept(requestId: string, toId: string) {
  const delay = Number(await getSetting("simAcceptMs", "2500"));
  const run = () => respondToRequest(toId, requestId, true).catch(() => {});
  if (process.env.NODE_ENV === "test" && delay === 0) await run();
  else setTimeout(run, delay);
}

export async function squadConnectState(userId: string, partyId: string) {
  const party = await prisma.party.findUnique({
    where: { id: partyId },
    include: { members: { include: { user: { select: { id: true, name: true, avatarColor: true, isSimulated: true } } } }, event: true, chat: true },
  });
  if (!party || !party.members.some((m) => m.userId === userId)) return null;
  const me = await subject(userId);
  const out = [];
  for (const m of party.members) {
    if (m.userId === userId) continue;
    const other = await subject(m.userId);
    let state: SquadFriendState = "add";
    if (!me || !other || !friendAllowed(me, other)) state = "unavailable";
    else if (await areFriends(userId, m.userId)) state = "friends";
    else {
      const [out_, in_] = await Promise.all([
        prisma.friendRequest.findUnique({ where: { fromId_toId: { fromId: userId, toId: m.userId } } }),
        prisma.friendRequest.findUnique({ where: { fromId_toId: { fromId: m.userId, toId: userId } } }),
      ]);
      if (in_?.status === "pending") state = "incoming";
      else if (out_?.status === "pending") state = "requested";
    }
    out.push({ ...m.user, state, sharedNote: await sharedNoteFor(partyId, userId, m.userId) });
  }
  return { partyId, eventTitle: party.event?.title ?? "", over: party.status === "completed" || Boolean(party.chat?.archived), members: out };
}
