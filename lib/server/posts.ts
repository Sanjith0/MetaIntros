/**
 * Posts & stories, and the "Share the outing" step after a squad's event.
 *
 * Every rule is enforced here in code, never by the AI:
 *  - audience: "friends" (the author's friends) or "only_me";
 *  - blocks: blocked users (either direction) never see each other's posts, stories or photos;
 *  - consent: a squadmate's album photo is usable only while its "Squadmates can include this in a post"
 *    flag is on, re-checked on every view (turning it off later removes it from posts);
 *  - stories expire 24h after they're posted, on the global clock;
 *  - posts never expose the album: post photos are served by a post-scoped route.
 */
import { prisma } from "@/lib/db";
import { z } from "zod";
import { isSensitiveTag } from "@/lib/graph/vocabulary";
import { label } from "@/lib/agents/describe";
import { draftPost, MAX_DRAFT_CAPTION, type DraftPhoto } from "@/lib/agents/postDraft";
import type { WeightedTag } from "@/lib/profile/builder";
import { albumParty, albumPhotoUrl } from "./album";
import { publish } from "./bus";

export const STORY_TTL_MS = 24 * 3600_000;
export const MAX_POST_PHOTOS = 10;
export const MAX_POST_CAPTION = 500;

export const PostKind = z.enum(["post", "story"]);
export const PostAudience = z.enum(["friends", "only_me"]);
export const AI_SOURCES = ["live", "cache", "mock", "fallback"] as const;
export type ShareChoiceKind = "own" | "ai" | "none";

// ── relationships ───────────────────────────────────────────────────────────────────────────

export async function friendIdsOf(userId: string): Promise<Set<string>> {
  const fs = await prisma.friendship.findMany({ where: { OR: [{ userAId: userId }, { userBId: userId }] }, select: { userAId: true, userBId: true } });
  return new Set(fs.map((f) => (f.userAId === userId ? f.userBId : f.userAId)));
}

export async function blockedIdsOf(userId: string): Promise<Set<string>> {
  const bs = await prisma.block.findMany({ where: { OR: [{ blockerId: userId }, { blockedId: userId }] }, select: { blockerId: true, blockedId: true } });
  return new Set(bs.map((b) => (b.blockerId === userId ? b.blockedId : b.blockerId)));
}

// ── visibility ──────────────────────────────────────────────────────────────────────────────

interface PostLike {
  authorId: string;
  kind: string;
  audience: string;
  createdAt: Date;
}

export const storyExpired = (p: { kind: string; createdAt: Date }, now: Date) => p.kind === "story" && now.getTime() - p.createdAt.getTime() >= STORY_TTL_MS;

/** Can `viewerId` see this post at all? (Photos are checked separately: photoVisible.) */
export function canViewPost(viewerId: string, p: PostLike, ctx: { friends: Set<string>; blocked: Set<string> }, now: Date) {
  if (storyExpired(p, now)) return false;
  if (p.authorId === viewerId) return true;
  if (ctx.blocked.has(p.authorId)) return false;
  return p.audience === "friends" && ctx.friends.has(p.authorId);
}

/** A photo stays in a post only while its uploader allows it (or it's the author's own) and the viewer isn't blocked from them. */
export function photoVisible(authorId: string, photo: { uploaderId: string; shareable: boolean }, blocked: Set<string>) {
  if (blocked.has(photo.uploaderId)) return false;
  return photo.uploaderId === authorId || photo.shareable;
}

export interface PostView {
  id: string;
  kind: "post" | "story";
  mine: boolean;
  author: { id: string; name: string; avatarColor: string; isSimulated: boolean; isLive: boolean };
  caption: string;
  audience: "friends" | "only_me";
  createdAt: string;
  event: { id: string; title: string; kind: string } | null;
  aiSource: string | null;
  aiEdited: boolean;
  photos: { id: string; url: string }[];
}

export const postPhotoUrl = (postId: string, photoId: string) => `/api/posts/${postId}/photos/${photoId}`;

const postInclude = { photos: { orderBy: { position: "asc" as const }, include: { photo: { select: { id: true, uploaderId: true, shareable: true } } } } };

/** Real posts and stories for Home: own + friends' (audience friends), blocks excluded, expired stories gone. */
export async function listFeed(viewerId: string, now: Date) {
  const [friends, blocked] = await Promise.all([friendIdsOf(viewerId), blockedIdsOf(viewerId)]);
  const authorIds = [viewerId, ...[...friends].filter((f) => !blocked.has(f))];
  const rows = await prisma.post.findMany({
    where: {
      authorId: { in: authorIds },
      OR: [{ kind: "post" }, { kind: "story", createdAt: { gt: new Date(now.getTime() - STORY_TTL_MS) } }],
    },
    include: postInclude,
    orderBy: { createdAt: "desc" },
    take: 60,
  });
  const visible = rows.filter((p) => canViewPost(viewerId, p, { friends, blocked }, now));
  const [users, events] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: [...new Set(visible.map((p) => p.authorId))] } }, select: { id: true, name: true, avatarColor: true, isSimulated: true, isLive: true } }),
    prisma.event.findMany({ where: { id: { in: visible.flatMap((p) => (p.eventId ? [p.eventId] : [])) } }, select: { id: true, title: true, kind: true } }),
  ]);
  const userById = new Map(users.map((u) => [u.id, u]));
  const eventById = new Map(events.map((e) => [e.id, e]));
  const views: PostView[] = [];
  for (const p of visible) {
    const author = userById.get(p.authorId);
    if (!author) continue; // deleted account
    const photos = p.photos.filter((pp) => photoVisible(p.authorId, pp.photo, blocked)).map((pp) => ({ id: pp.photoId, url: postPhotoUrl(p.id, pp.photoId) }));
    if (!photos.length && !p.caption.trim()) continue; // every photo was removed and there's no text left
    views.push({
      id: p.id,
      kind: p.kind === "story" ? "story" : "post",
      mine: p.authorId === viewerId,
      author,
      caption: p.caption,
      audience: p.audience === "only_me" ? "only_me" : "friends",
      createdAt: p.createdAt.toISOString(),
      event: p.eventId ? eventById.get(p.eventId) ?? null : null,
      aiSource: p.aiSource,
      aiEdited: p.aiEdited,
      photos,
    });
  }
  const posts = views.filter((v) => v.kind === "post");
  // stories: one rail tile per author, own first, then the most recent; frames oldest → newest
  const groups = new Map<string, PostView[]>();
  for (const s of views.filter((v) => v.kind === "story")) groups.set(s.author.id, [...(groups.get(s.author.id) ?? []), s]);
  const stories = [...groups.values()]
    .map((frames) => ({ author: frames[0].author, mine: frames[0].mine, latest: frames[0].createdAt, frames: [...frames].reverse() }))
    .sort((a, b) => Number(b.mine) - Number(a.mine) || b.latest.localeCompare(a.latest));
  return { posts, stories };
}

export type StoryGroup = Awaited<ReturnType<typeof listFeed>>["stories"][number];

/** Raw photo for a post: the viewer must be able to see the post AND the photo must still be allowed. */
export async function getPostPhotoData(viewerId: string, postId: string, photoId: string, now: Date): Promise<string | null> {
  const link = await prisma.postPhoto.findUnique({ where: { postId_photoId: { postId, photoId } }, include: { post: true, photo: true } });
  if (!link) return null;
  const [friends, blocked] = await Promise.all([friendIdsOf(viewerId), blockedIdsOf(viewerId)]);
  if (!canViewPost(viewerId, link.post, { friends, blocked }, now)) return null;
  if (!photoVisible(link.post.authorId, link.photo, blocked)) return null;
  if (!(await prisma.user.findUnique({ where: { id: link.post.authorId }, select: { id: true } }))) return null;
  return link.photo.dataUrl;
}

/** Squadmates' posts and stories about squads you were in, that you're allowed to see (Notifications). */
export async function squadPostsFor(userId: string, now: Date) {
  const parties = (await prisma.partyMember.findMany({ where: { userId }, select: { partyId: true } })).map((m) => m.partyId);
  if (!parties.length) return [];
  const rows = await prisma.post.findMany({ where: { partyId: { in: parties }, authorId: { not: userId } }, orderBy: { createdAt: "desc" }, take: 20 });
  if (!rows.length) return [];
  const [friends, blocked] = await Promise.all([friendIdsOf(userId), blockedIdsOf(userId)]);
  const visible = rows.filter((p) => canViewPost(userId, p, { friends, blocked }, now));
  const [users, events] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: visible.map((p) => p.authorId) } }, select: { id: true, name: true, avatarColor: true } }),
    prisma.event.findMany({ where: { id: { in: visible.flatMap((p) => (p.eventId ? [p.eventId] : [])) } }, select: { id: true, title: true } }),
  ]);
  const userById = new Map(users.map((u) => [u.id, u]));
  const titleById = new Map(events.map((e) => [e.id, e.title]));
  return visible.flatMap((p) => {
    const author = userById.get(p.authorId);
    return author ? [{ id: p.id, kind: p.kind, author, eventTitle: (p.eventId && titleById.get(p.eventId)) || "your outing", createdAt: p.createdAt }] : [];
  });
}

// ── creating ────────────────────────────────────────────────────────────────────────────────

export const CreatePostBody = z.object({
  kind: PostKind,
  audience: PostAudience,
  caption: z.string().max(MAX_POST_CAPTION * 2).default(""),
  partyId: z.string().nullish(),
  photoIds: z.array(z.string()).max(MAX_POST_PHOTOS).default([]),
  /** when the caption started as an AI draft: who wrote it and the drafted text (to tell if it was edited) */
  ai: z.object({ source: z.enum(AI_SOURCES), caption: z.string() }).nullish(),
});
export type CreatePostInput = z.input<typeof CreatePostBody>;

export type PostError = "bad_body" | "empty" | "caption_too_long" | "not_found" | "photo_not_allowed";

export async function createPost(authorId: string, input: CreatePostInput) {
  const parsed = CreatePostBody.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "bad_body" as PostError };
  const b = parsed.data;
  const caption = b.caption.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (caption.length > MAX_POST_CAPTION) return { ok: false as const, error: "caption_too_long" as PostError };
  const photoIds = [...new Set(b.photoIds)];
  if (!caption && !photoIds.length) return { ok: false as const, error: "empty" as PostError };

  let eventId: string | null = null;
  if (b.partyId || photoIds.length) {
    if (!b.partyId) return { ok: false as const, error: "photo_not_allowed" as PostError };
    const party = await albumParty(b.partyId, authorId);
    if (!party) return { ok: false as const, error: "not_found" as PostError };
    eventId = party.eventId;
    const members = new Set(party.members.map((m) => m.userId));
    const photos = await prisma.albumPhoto.findMany({ where: { id: { in: photoIds } }, select: { id: true, partyId: true, uploaderId: true, shareable: true } });
    const byId = new Map(photos.map((p) => [p.id, p]));
    for (const id of photoIds) {
      const p = byId.get(id);
      // own photos always; a squadmate's only while their consent flag is on
      if (!p || p.partyId !== b.partyId || !members.has(p.uploaderId) || (p.uploaderId !== authorId && !p.shareable)) return { ok: false as const, error: "photo_not_allowed" as PostError };
    }
  }

  const post = await prisma.post.create({
    data: {
      authorId,
      kind: b.kind,
      audience: b.audience,
      caption,
      partyId: b.partyId ?? null,
      eventId,
      aiSource: b.ai?.source ?? null,
      aiEdited: b.ai ? b.ai.caption.trim() !== caption : false,
      photos: { create: photoIds.map((photoId, position) => ({ photoId, position })) },
    },
  });
  if (b.partyId) await recordChoice(b.partyId, authorId, b.ai ? "ai" : "own", post.id);
  const audience = b.audience === "friends" ? [authorId, ...(await friendIdsOf(authorId))] : [authorId];
  publish("posts", { postId: post.id }, audience);
  publish("badges", {}, audience);
  return { ok: true as const, id: post.id, kind: post.kind };
}

export async function deletePost(authorId: string, postId: string) {
  const r = await prisma.post.deleteMany({ where: { id: postId, authorId } });
  if (r.count) publish("posts", {});
  return r.count > 0;
}

// ── share the outing ────────────────────────────────────────────────────────────────────────

async function recordChoice(partyId: string, userId: string, choice: ShareChoiceKind, postId: string | null) {
  await prisma.shareChoice.upsert({
    where: { partyId_userId: { partyId, userId } },
    create: { partyId, userId, choice, postId },
    update: { choice, postId },
  });
  publish("party", { partyId }, [userId]);
}

/** The event is over on the global clock, or the squad chat has ended. */
export function shareOpen(p: { event: { endsAt: Date } | null; chat: { archived: boolean } | null }, now: Date) {
  return Boolean(p.event && (now >= p.event.endsAt || p.chat?.archived));
}

export async function getShareChoice(partyId: string, userId: string) {
  return prisma.shareChoice.findUnique({ where: { partyId_userId: { partyId, userId } } });
}

/** "Don't post": remembered so the prompt stops showing. */
export async function declineShare(partyId: string, userId: string, now: Date) {
  const p = await albumParty(partyId, userId);
  if (!p) return { ok: false as const, error: "not_found" };
  if (!shareOpen(p, now)) return { ok: false as const, error: "not_over" };
  await recordChoice(partyId, userId, "none", null);
  return { ok: true as const };
}

export interface ShareablePhoto {
  id: string;
  url: string;
  mine: boolean;
  uploaderName: string;
  caption: string | null;
}

/** Album photos `userId` may put in a post: their own, plus squadmates' with consent on. */
export async function allowedPhotos(partyId: string, userId: string, memberIds: string[]) {
  return prisma.albumPhoto.findMany({
    where: { partyId, uploaderId: { in: memberIds }, OR: [{ uploaderId: userId }, { shareable: true }] },
    select: { id: true, uploaderId: true, caption: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
}

/** Everything the "Share the outing" screen needs. Null when not a member of a ready squad. */
export async function shareState(partyId: string, userId: string, now: Date) {
  const p = await albumParty(partyId, userId);
  if (!p?.event) return null;
  const memberIds = p.members.map((m) => m.userId);
  const nameOf = new Map(p.members.map((m) => [m.userId, m.user.name]));
  const [photos, choice] = await Promise.all([allowedPhotos(partyId, userId, memberIds), getShareChoice(partyId, userId)]);
  return {
    partyId,
    eventId: p.event.id,
    eventTitle: p.event.title,
    open: shareOpen(p, now),
    choice: (choice?.choice as ShareChoiceKind | undefined) ?? null,
    photos: photos.map<ShareablePhoto>((ph) => ({ id: ph.id, url: albumPhotoUrl(partyId, ph.id), mine: ph.uploaderId === userId, uploaderName: nameOf.get(ph.uploaderId) ?? "", caption: ph.caption })),
  };
}

export type ShareState = NonNullable<Awaited<ReturnType<typeof shareState>>>;

/** Interest labels at least two squad members share, most common first (non-sensitive only). */
export async function squadSharedInterests(memberIds: string[], max = 3): Promise<string[]> {
  const profiles = await prisma.tasteProfile.findMany({ where: { userId: { in: memberIds } }, select: { interestTags: true } });
  const count = new Map<string, { n: number; w: number }>();
  for (const p of profiles)
    for (const t of (p.interestTags ?? []) as unknown as WeightedTag[]) {
      if (!t?.tag || isSensitiveTag(t.tag)) continue;
      const c = count.get(t.tag) ?? { n: 0, w: 0 };
      count.set(t.tag, { n: c.n + 1, w: c.w + (t.weight ?? 0) });
    }
  return [...count.entries()]
    .filter(([, c]) => c.n >= 2)
    .sort((a, b) => b[1].n - a[1].n || b[1].w - a[1].w || a[0].localeCompare(b[0]))
    .slice(0, max)
    .map(([tag]) => label(tag));
}

/** "Let AI suggest a post": a draft only — nothing is posted until the user taps Share. */
export async function suggestPost(partyId: string, userId: string, now: Date) {
  const p = await albumParty(partyId, userId);
  if (!p?.event) return { ok: false as const, error: "not_found" };
  if (!shareOpen(p, now)) return { ok: false as const, error: "not_over" };
  const memberIds = p.members.map((m) => m.userId);
  const [photos, friends, interests] = await Promise.all([allowedPhotos(partyId, userId, memberIds), friendIdsOf(userId), squadSharedInterests(memberIds)]);
  const first = (name: string) => name.split(" ")[0];
  const nameOf = new Map(p.members.map((m) => [m.userId, m.user.name]));
  const me = p.members.find((m) => m.userId === userId)!.user;
  // squadmates who aren't the poster's friends must not be named in the caption (first or last name)
  const hiddenNames = p.members.filter((m) => m.userId !== userId && !friends.has(m.userId)).flatMap((m) => m.user.name.split(/\s+/).filter((n) => n.length > 1));
  const startMs = p.event.startsAt.getTime();
  const draftPhotos: DraftPhoto[] = photos.map((ph) => ({
    id: ph.id,
    uploaderFirstName: first(nameOf.get(ph.uploaderId) ?? ""),
    caption: ph.caption,
    minutesSinceStart: Math.round((ph.createdAt.getTime() - startMs) / 60_000),
    own: ph.uploaderId === userId,
  }));
  const d = await draftPost({
    posterFirstName: first(me.name),
    event: { title: p.event.title, kind: p.event.kind === "hangout" ? "hangout" : "event" },
    sharedInterests: interests,
    photos: draftPhotos,
    hiddenNames,
  });
  return { ok: true as const, draft: { photoIds: d.photoIds, caption: d.caption.slice(0, MAX_DRAFT_CAPTION + 1), source: d.source, stripped: d.stripped } };
}

/** Albums `userId` can post from (any ready squad they're in), for the Home composer. */
export async function myAlbums(userId: string) {
  const ms = await prisma.partyMember.findMany({
    where: { userId, party: { status: { in: ["confirmed", "completed"] }, eventId: { not: null } } },
    include: { party: { include: { event: { select: { title: true } }, members: { include: { user: { select: { name: true } } } } } } },
    orderBy: { joinedAt: "desc" },
    take: 5,
  });
  const out: { partyId: string; eventTitle: string; photos: ShareablePhoto[] }[] = [];
  for (const m of ms) {
    const memberIds = m.party.members.map((x) => x.userId);
    const nameOf = new Map(m.party.members.map((x) => [x.userId, x.user.name]));
    const photos = await allowedPhotos(m.partyId, userId, memberIds);
    if (!photos.length) continue;
    out.push({
      partyId: m.partyId,
      eventTitle: m.party.event?.title ?? "",
      photos: photos.map((ph) => ({ id: ph.id, url: albumPhotoUrl(m.partyId, ph.id), mine: ph.uploaderId === userId, uploaderName: nameOf.get(ph.uploaderId) ?? "", caption: ph.caption })),
    });
  }
  return out;
}
