import { prisma } from "@/lib/db";
import { QueueVisibility } from "@/lib/domain/enums";
import { canJoinFriendQueue, canSeeQueue, type CantJoinReason, type VisibilitySubject } from "@/lib/match/queueVisibility";
import { friendIdsOf } from "./events";
import { joinQueue, notifyFriends, type JoinResult } from "./queue";
import { isAdultBand } from "./signup";
import { nowDate } from "@/lib/clock";
import { loadPeople } from "@/lib/profile/load";
import { writeWhy } from "@/lib/agents/friendQueueWhy";

/**
 * Friends' queues: which queues your friends are in, if they chose to share. Every read goes through
 * canSeeQueue (lib/match/queueVisibility.ts). What a viewer gets is deliberately small: the friend, the
 * event (or "any event" / "a new hangout", never a hangout's venue), the coarse landmark area, and whether
 * they're still waiting or already in a squad. Never the other people in the queue or the squad.
 */
export interface FriendQueue {
  entryId: string;
  friend: { id: string; name: string; avatarColor: string };
  mode: "events" | "hangout";
  event: { id: string; title: string; startsAt: string } | null;
  area: string;
  state: "waiting" | "in_squad";
  since: string;
  targetSize: number;
  /** "Queuing for Indie Night" etc. Subject-less so callers can put the name first. */
  label: string;
  canJoin: boolean;
  cantJoinReason?: CantJoinReason | "in_squad" | "started";
}

const LIVE_PARTY = ["forming", "confirming", "confirmed"];

async function subjects(ids: string[]): Promise<Map<string, VisibilitySubject & { name: string; avatarColor: string }>> {
  const [users, blocks] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, avatarColor: true, ageBand: true, gender: true, womenOnlyParty: true, queueVisibility: true },
    }),
    prisma.block.findMany({ where: { OR: [{ blockerId: { in: ids } }, { blockedId: { in: ids } }] } }),
  ]);
  const out = new Map(users.map((u) => [u.id, { ...u, blocked: new Set<string>() }]));
  for (const b of blocks) {
    out.get(b.blockerId)?.blocked.add(b.blockedId);
    out.get(b.blockedId)?.blocked.add(b.blockerId);
  }
  return out;
}

export function friendQueueLabel(q: Pick<FriendQueue, "mode" | "event" | "state">): string {
  const what = q.mode === "hangout" ? "a new hangout" : q.event ? q.event.title : "any event this weekend";
  if (q.state === "in_squad") return q.mode === "hangout" ? "In a squad planning a new hangout" : `In a squad for ${what}`;
  return q.mode === "hangout" ? "Queuing to plan a new hangout" : `Queuing for ${what}`;
}

/** Friends' queues the viewer may see, newest first. `eventId` narrows to one event's queue. */
export async function listFriendQueues(viewerId: string, opts: { eventId?: string } = {}): Promise<FriendQueue[]> {
  const friends = await friendIdsOf(viewerId);
  if (!friends.size) return [];
  const entries = await prisma.queueEntry.findMany({
    where: {
      userId: { in: [...friends] },
      visibleToFriends: true,
      status: { in: ["waiting", "matched"] },
      ...(opts.eventId ? { eventId: opts.eventId } : {}),
    },
    include: {
      bucketLandmark: { select: { name: true } },
      event: { select: { id: true, title: true, startsAt: true, kind: true } },
      party: { select: { status: true, event: { select: { id: true, title: true, startsAt: true, kind: true } } } },
    },
    orderBy: { joinedAt: "desc" },
  });
  if (!entries.length) return [];
  const people = await subjects([viewerId, ...new Set(entries.map((e) => e.userId))]);
  const viewer = people.get(viewerId);
  if (!viewer) return [];
  const now = nowDate();
  const seen = new Set<string>();
  const out: FriendQueue[] = [];
  for (const e of entries) {
    if (seen.has(e.userId)) continue; // one (the latest) per friend
    const owner = people.get(e.userId);
    if (!owner || !canSeeQueue(viewer, owner, true, e.visibleToFriends)) continue;
    let state: FriendQueue["state"] = "waiting";
    if (e.status === "matched") {
      if (!e.party || !LIVE_PARTY.includes(e.party.status)) continue;
      state = "in_squad";
    }
    const mode = e.mode === "hangout" ? "hangout" : "events";
    // A hangout is squad-only: never its title or venue. A matched "any event" queue shows the event it got.
    const ev = mode === "hangout" ? null : (e.event ?? (e.party?.event?.kind === "event" ? e.party.event : null));
    if (ev && state === "waiting" && ev.startsAt <= now) continue; // the event already started: nothing to join
    seen.add(e.userId);
    const join = canJoinFriendQueue(viewer, owner);
    const q: FriendQueue = {
      entryId: e.id,
      friend: { id: owner.id, name: owner.name, avatarColor: owner.avatarColor },
      mode,
      event: ev ? { id: ev.id, title: ev.title, startsAt: ev.startsAt.toISOString() } : null,
      area: e.bucketLandmark.name,
      state,
      since: e.joinedAt.toISOString(),
      targetSize: e.targetPartySize,
      label: "",
      canJoin: state === "waiting" && join.ok,
      cantJoinReason: state === "in_squad" ? "in_squad" : join.ok ? undefined : join.reason,
    };
    q.label = friendQueueLabel(q);
    out.push(q);
  }
  return out.sort((a, b) => Number(a.state !== "waiting") - Number(b.state !== "waiting") || b.since.localeCompare(a.since));
}

/** "Queue up too": join the same queue as a friend (same event or mode, same area, same squad size). */
export async function joinFriendQueue(viewerId: string, entryId: string): Promise<JoinResult | { ok: false; error: "not_visible" | "cant_join" | "age" }> {
  const me = await prisma.user.findUnique({ where: { id: viewerId }, select: { ageBand: true } });
  if (!me || !isAdultBand(me.ageBand)) return { ok: false, error: "age" };
  const q = (await listFriendQueues(viewerId)).find((x) => x.entryId === entryId);
  if (!q) return { ok: false, error: "not_visible" };
  if (!q.canJoin) return { ok: false, error: "cant_join" };
  const entry = await prisma.queueEntry.findUniqueOrThrow({ where: { id: entryId } });
  return joinQueue(viewerId, {
    mode: q.mode,
    eventId: q.mode === "events" ? entry.eventId : null,
    targetSize: entry.targetPartySize,
    landmarkId: entry.bucketLandmarkId,
    locationSource: "manual",
    viaFriendId: q.friend.id,
  });
}

export async function setQueueVisibility(userId: string, visibility: QueueVisibility) {
  const v = QueueVisibility.parse(visibility);
  await prisma.user.update({ where: { id: userId }, data: { queueVisibility: v, queueVisibilityAskedAt: nowDate() } });
  // applies to the queue you're in right now too, so turning it off hides you at once
  await prisma.queueEntry.updateMany({ where: { userId, status: { in: ["waiting", "matched"] } }, data: { visibleToFriends: v === "friends" } });
  await notifyFriends(userId);
}

/** Home feed card: how many friends are visibly queuing (or in a squad) this weekend. */
export async function friendQueueSummary(viewerId: string) {
  const qs = await listFriendQueues(viewerId);
  return { count: qs.length, faces: qs.slice(0, 5).map((q) => q.friend), first: qs[0] ?? null };
}

/** The "why you'd like it" line on a friend's queue card. Only for queues the viewer may see. */
export async function whyForFriendQueue(viewerId: string, entryId: string) {
  const q = (await listFriendQueues(viewerId)).find((x) => x.entryId === entryId);
  if (!q) return null;
  const people = await loadPeople(prisma, [viewerId, q.friend.id]);
  const me = people.get(viewerId), friend = people.get(q.friend.id);
  if (!me || !friend) return null;
  const theirs = new Set(friend.profile.interestTags.map((t) => t.tag));
  const sharedTags = me.profile.interestTags.map((t) => t.tag).filter((t) => theirs.has(t));
  const ev = q.event ? await prisma.event.findUnique({ where: { id: q.event.id }, select: { title: true, tags: true } }) : null;
  return writeWhy({
    friendFirstName: q.friend.name.split(" ")[0],
    sharedTags,
    event: ev ? { title: ev.title, tags: (ev.tags as string[]) ?? [] } : null,
    mode: q.mode,
  });
}
