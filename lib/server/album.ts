/**
 * The squad album: photos any member can add once the squad is ready, during and after the event.
 * Members only (everyone else gets "not found", no existence leak). Unlike find-me photos it is NOT
 * cleared when the squad chat ends: it's the memory. The uploader can always delete their own photos,
 * and each photo carries the uploader's consent for squadmates to include it in a post.
 */
import { prisma } from "@/lib/db";
import { isSensitiveText } from "@/lib/cards/claims";
import { publish } from "./bus";

/** Client resizes to ~1024px JPEG; this caps the decoded size. */
export const MAX_ALBUM_PHOTO_BYTES = 600_000;
export const MAX_ALBUM_PHOTOS = 30;
export const MAX_PHOTO_CAPTION = 80;
const DATA_URL = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
/** Squad is ready (or over): the album is open. */
const READY = ["confirmed", "completed"];

export type AlbumError = "not_found" | "bad_image" | "album_full" | "caption_too_long" | "sensitive_caption";

export interface AlbumPhotoView {
  id: string;
  uploader: { id: string; name: string; avatarColor: string; isSimulated: boolean; isLive: boolean };
  caption: string | null;
  shareable: boolean;
  mine: boolean;
  createdAt: string;
  url: string;
}

export const albumPhotoUrl = (partyId: string, photoId: string) => `/api/squad/${partyId}/album/${photoId}`;

/** The squad, if `userId` is a member and the squad is ready; null otherwise (callers answer 404). */
export async function albumParty(partyId: string, userId: string) {
  const p = await prisma.party.findUnique({
    where: { id: partyId },
    include: {
      event: true,
      chat: { select: { id: true, archived: true } },
      members: { include: { user: { select: { id: true, name: true, avatarColor: true, isSimulated: true, isLive: true } } }, orderBy: { joinedAt: "asc" } },
    },
  });
  if (!p || !READY.includes(p.status) || !p.members.some((m) => m.userId === userId)) return null;
  return p;
}

const memberIdsOf = (p: { members: { userId: string }[] }) => p.members.map((m) => m.userId);

function cleanCaption(raw: string | null | undefined): { ok: true; caption: string | null } | { ok: false; error: AlbumError } {
  const c = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!c) return { ok: true, caption: null };
  if (c.length > MAX_PHOTO_CAPTION) return { ok: false, error: "caption_too_long" };
  if (isSensitiveText(c)) return { ok: false, error: "sensitive_caption" };
  return { ok: true, caption: c };
}

/** Album photos whose uploader is still in the squad (rows from deleted accounts never show). */
async function albumRows(partyId: string, memberIds: string[]) {
  return prisma.albumPhoto.findMany({
    where: { partyId, uploaderId: { in: memberIds } },
    select: { id: true, uploaderId: true, caption: true, shareable: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function listAlbum(partyId: string, viewerId: string) {
  const p = await albumParty(partyId, viewerId);
  if (!p) return null;
  const rows = await albumRows(partyId, memberIdsOf(p));
  const byId = new Map(p.members.map((m) => [m.userId, m.user]));
  const photos: AlbumPhotoView[] = rows.map((r) => ({
    id: r.id,
    uploader: byId.get(r.uploaderId)!,
    caption: r.caption,
    shareable: r.shareable,
    mine: r.uploaderId === viewerId,
    createdAt: r.createdAt.toISOString(),
    url: albumPhotoUrl(partyId, r.id),
  }));
  return { partyId, eventTitle: p.event?.title ?? "", eventId: p.eventId, photos, max: MAX_ALBUM_PHOTOS, full: photos.length >= MAX_ALBUM_PHOTOS };
}

export async function addAlbumPhoto(partyId: string, userId: string, input: { dataUrl: string; caption?: string | null; shareable?: boolean }) {
  const p = await albumParty(partyId, userId);
  if (!p) return { ok: false as const, error: "not_found" as AlbumError };
  if (!DATA_URL.test(input.dataUrl) || input.dataUrl.length > MAX_ALBUM_PHOTO_BYTES * 1.37) return { ok: false as const, error: "bad_image" as AlbumError };
  const cap = cleanCaption(input.caption);
  if (!cap.ok) return cap;
  if ((await prisma.albumPhoto.count({ where: { partyId } })) >= MAX_ALBUM_PHOTOS) return { ok: false as const, error: "album_full" as AlbumError };
  const photo = await prisma.albumPhoto.create({
    data: { partyId, uploaderId: userId, dataUrl: input.dataUrl, caption: cap.caption, shareable: input.shareable ?? true },
    select: { id: true },
  });
  publish("album", { partyId }, memberIdsOf(p));
  return { ok: true as const, id: photo.id };
}

/** Uploader only: change the consent flag or the caption. */
export async function updateAlbumPhoto(partyId: string, userId: string, photoId: string, patch: { shareable?: boolean; caption?: string | null }) {
  const p = await albumParty(partyId, userId);
  const photo = p ? await prisma.albumPhoto.findUnique({ where: { id: photoId } }) : null;
  if (!p || !photo || photo.partyId !== partyId || photo.uploaderId !== userId) return { ok: false as const, error: "not_found" as AlbumError };
  const data: { shareable?: boolean; caption?: string | null } = {};
  if (patch.shareable !== undefined) data.shareable = patch.shareable;
  if (patch.caption !== undefined) {
    const cap = cleanCaption(patch.caption);
    if (!cap.ok) return cap;
    data.caption = cap.caption;
  }
  await prisma.albumPhoto.update({ where: { id: photoId }, data });
  publish("album", { partyId }, memberIdsOf(p));
  // posts that used this photo re-check consent on every view, so friends' feeds update too
  publish("posts", {});
  return { ok: true as const };
}

/**
 * Uploader only, always allowed (even after the squad chat ends). Posts referencing it drop it
 * (PostPhoto cascades).
 */
export async function deleteAlbumPhoto(partyId: string, userId: string, photoId: string) {
  const photo = await prisma.albumPhoto.findUnique({ where: { id: photoId } });
  const member = photo ? await prisma.partyMember.findUnique({ where: { partyId_userId: { partyId, userId } } }) : null;
  if (!photo || !member || photo.partyId !== partyId || photo.uploaderId !== userId) return { ok: false as const, error: "not_found" as AlbumError };
  await prisma.albumPhoto.delete({ where: { id: photoId } });
  const members = (await prisma.partyMember.findMany({ where: { partyId }, select: { userId: true } })).map((m) => m.userId);
  publish("album", { partyId }, members);
  publish("posts", {});
  return { ok: true as const };
}

/** Raw photo for the album route: members of a ready squad only. */
export async function getAlbumPhotoData(partyId: string, viewerId: string, photoId: string): Promise<string | null> {
  const p = await albumParty(partyId, viewerId);
  if (!p) return null;
  const photo = await prisma.albumPhoto.findUnique({ where: { id: photoId } });
  if (!photo || photo.partyId !== partyId || !memberIdsOf(p).includes(photo.uploaderId)) return null;
  return photo.dataUrl;
}

/** Turn a stored data URL into an image response body. */
export function decodeDataUrl(url: string): { mime: string; bytes: Buffer } | null {
  const m = url.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
  return m ? { mime: m[1], bytes: Buffer.from(m[2], "base64") } : null;
}

/** Photos in the album from current members (for the squad info row). */
export async function albumCount(partyId: string, memberIds: string[]) {
  return prisma.albumPhoto.count({ where: { partyId, uploaderId: { in: memberIds } } });
}
