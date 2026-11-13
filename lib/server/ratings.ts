/**
 * Post-event squad ratings: the pop-up in an ended squad chat, and the signals matching and event picks
 * read back. Rules:
 * - Only squad members can rate, and only after the chat has ended (the night is over).
 * - You rate the night (1–5) and, optionally, each squadmate: "again" or "not again".
 * - A rating is only ever read back by its rater. Everyone else gets anonymous signals
 *   (lib/match/ratings.ts): nobody is told who rated whom, or how.
 */
import { prisma } from "@/lib/db";
import { MATE_VERDICTS, pairSignals, tagAffinity, type MateEdge, type MateVerdict, type PairSignals } from "@/lib/match/ratings";

export interface RatingMate {
  id: string;
  name: string;
  avatarColor: string;
  sample: boolean;
}

export interface RatingState {
  partyId: string;
  eventTitle: string;
  /** the squad chat has ended, so rating is open */
  ended: boolean;
  mates: RatingMate[];
  /** your own answers (null = not answered yet) */
  mine: { stars: number | null; mates: Record<string, MateVerdict> } | null;
  /** show the pop-up now: ended and not answered (a "Not now" counts as answered) */
  askNow: boolean;
}

async function squadFor(partyId: string, userId: string) {
  const party = await prisma.party.findUnique({
    where: { id: partyId },
    include: {
      event: true,
      chat: { select: { archived: true } },
      members: { include: { user: { select: { id: true, name: true, avatarColor: true, isSimulated: true, isLive: true } } }, orderBy: { joinedAt: "asc" } },
    },
  });
  if (!party || !party.members.some((m) => m.userId === userId)) return null;
  return party;
}

const isEnded = (p: { status: string; chat: { archived: boolean } | null }) => p.status === "completed" || Boolean(p.chat?.archived);

export async function getRatingState(partyId: string, userId: string): Promise<RatingState | null> {
  const party = await squadFor(partyId, userId);
  if (!party) return null;
  const [own, mates] = await Promise.all([
    prisma.squadRating.findUnique({ where: { partyId_raterId: { partyId, raterId: userId } } }),
    prisma.mateRating.findMany({ where: { partyId, raterId: userId } }),
  ]);
  const ended = isEnded(party);
  return {
    partyId,
    eventTitle: party.event?.kind === "hangout" ? "your hangout" : (party.event?.title ?? "your squad night"),
    ended,
    mates: party.members
      .filter((m) => m.userId !== userId)
      .map((m) => ({ id: m.user.id, name: m.user.name, avatarColor: m.user.avatarColor, sample: m.user.isSimulated && !m.user.isLive })),
    mine: own ? { stars: own.stars, mates: Object.fromEntries(mates.map((m) => [m.rateeId, m.verdict as MateVerdict])) } : null,
    askNow: ended && !own,
  };
}

export type RatingError = "not_found" | "not_ended" | "bad_stars" | "bad_mate";

/** Save (or update) your rating of the night and your squadmates. */
export async function submitRating(
  partyId: string,
  userId: string,
  input: { stars: number; mates?: Record<string, string> },
): Promise<{ ok: true } | { ok: false; error: RatingError }> {
  const party = await squadFor(partyId, userId);
  if (!party) return { ok: false, error: "not_found" };
  if (!isEnded(party)) return { ok: false, error: "not_ended" };
  if (!Number.isInteger(input.stars) || input.stars < 1 || input.stars > 5) return { ok: false, error: "bad_stars" };
  const mateIds = new Set(party.members.map((m) => m.userId).filter((id) => id !== userId));
  const entries = Object.entries(input.mates ?? {});
  if (entries.some(([id, v]) => !mateIds.has(id) || !MATE_VERDICTS.includes(v as MateVerdict))) return { ok: false, error: "bad_mate" };
  const tags = (party.event?.tags as string[] | undefined) ?? [];
  await prisma.$transaction([
    prisma.squadRating.upsert({
      where: { partyId_raterId: { partyId, raterId: userId } },
      create: { partyId, raterId: userId, eventId: party.eventId, stars: input.stars, tags },
      update: { stars: input.stars, tags },
    }),
    prisma.mateRating.deleteMany({ where: { partyId, raterId: userId } }),
    ...entries.map(([rateeId, verdict]) => prisma.mateRating.create({ data: { partyId, raterId: userId, rateeId, verdict } })),
  ]);
  return { ok: true };
}

/** "Not now": remember it so the pop-up doesn't come back. You can still rate later from the chat. */
export async function skipRating(partyId: string, userId: string): Promise<{ ok: true } | { ok: false; error: RatingError }> {
  const party = await squadFor(partyId, userId);
  if (!party) return { ok: false, error: "not_found" };
  if (!isEnded(party)) return { ok: false, error: "not_ended" };
  await prisma.squadRating.upsert({
    where: { partyId_raterId: { partyId, raterId: userId } },
    create: { partyId, raterId: userId, eventId: party.eventId, stars: null },
    update: {},
  });
  return { ok: true };
}

// ───────────────────────── signals for matching and event picks ─────────────────────────

/** "Again" / "not again" signals between these people (only edges where both are in the set). */
export async function ratingSignals(userIds: string[]): Promise<PairSignals> {
  if (userIds.length < 2) return pairSignals([]);
  const rows = await prisma.mateRating.findMany({
    where: { raterId: { in: userIds }, rateeId: { in: userIds } },
    orderBy: { createdAt: "asc" },
    select: { raterId: true, rateeId: true, verdict: true },
  });
  return pairSignals(rows.filter((r) => MATE_VERDICTS.includes(r.verdict as MateVerdict)) as MateEdge[]);
}

/** Learned tag affinity per person, from their own star ratings. People who never rated are absent. */
export async function tagAffinities(userIds: string[]): Promise<Map<string, Map<string, number>>> {
  const rows = await prisma.squadRating.findMany({ where: { raterId: { in: userIds }, stars: { not: null } }, select: { raterId: true, stars: true, tags: true } });
  const by = new Map<string, { stars: number; tags: string[] }[]>();
  for (const r of rows) by.set(r.raterId, [...(by.get(r.raterId) ?? []), { stars: r.stars!, tags: (r.tags as string[]) ?? [] }]);
  const out = new Map<string, Map<string, number>>();
  for (const [id, rs] of by) {
    const a = tagAffinity(rs);
    if (a.size) out.set(id, a);
  }
  return out;
}

/** Squad-level affinity: the sum of every member's learned affinity per tag. */
export async function squadTagAffinity(userIds: string[]): Promise<Map<string, number>> {
  const per = await tagAffinities(userIds);
  const out = new Map<string, number>();
  for (const a of per.values()) for (const [t, v] of a) out.set(t, Math.round(((out.get(t) ?? 0) + v) * 1000) / 1000);
  return out;
}
