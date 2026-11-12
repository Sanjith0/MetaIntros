import { prisma } from "@/lib/db";
import { publish } from "./bus";
import { memberIds as chatMemberIds } from "./messages";
import { nowDate } from "@/lib/clock";

export const MAX_PHOTO_BYTES = 400_000;
const DATA_URL = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;

async function partyMemberIds(partyId: string) {
  return (await prisma.partyMember.findMany({ where: { partyId }, select: { userId: true } })).map((m) => m.userId);
}

export async function isPartyMember(partyId: string, userId: string) {
  return Boolean(await prisma.partyMember.findUnique({ where: { partyId_userId: { partyId, userId } } }));
}

/** Opt in with a photo only this party can see (or opt out, which deletes it). */
export async function setPartyPhoto(partyId: string, userId: string, dataUrl: string | null) {
  if (!(await isPartyMember(partyId, userId))) return { ok: false as const, error: "not_member" };
  if (dataUrl !== null && (!DATA_URL.test(dataUrl) || dataUrl.length > MAX_PHOTO_BYTES * 1.37)) return { ok: false as const, error: "bad_image" };
  await prisma.partyMember.update({ where: { partyId_userId: { partyId, userId } }, data: { photoOptIn: dataUrl !== null, photoUrl: dataUrl } });
  publish("party-update", { partyId }, await partyMemberIds(partyId));
  return { ok: true as const };
}

/** Party-scoped photo access: only fellow members, only if the owner opted in. */
export async function getPartyPhoto(partyId: string, viewerId: string, ownerId: string): Promise<string | null> {
  if (!(await isPartyMember(partyId, viewerId))) return null;
  const m = await prisma.partyMember.findUnique({ where: { partyId_userId: { partyId, userId: ownerId } } });
  return m?.photoOptIn ? m.photoUrl : null;
}

export async function checkIn(partyId: string, userId: string) {
  if (!(await isPartyMember(partyId, userId))) return { ok: false as const, error: "not_member" };
  const m = await prisma.partyMember.update({ where: { partyId_userId: { partyId, userId } }, data: { checkedInAt: nowDate() } });
  const members = await partyMemberIds(partyId);
  publish("party-update", { partyId, checkIn: userId }, members);
  void chatMemberIds;
  return { ok: true as const, checkedInAt: m.checkedInAt };
}

/** Demo: simulated squadmates arrive a few seconds after a real member checks in. */
export async function simulateArrivals(partyId: string, delayMs = 2500) {
  if (process.env.NODE_ENV === "test") return;
  const sims = await prisma.partyMember.findMany({ where: { partyId, checkedInAt: null, user: { isSimulated: true } } });
  sims.forEach((m, i) => setTimeout(() => checkIn(partyId, m.userId).catch(() => {}), delayMs * (i + 1)));
}

export async function arrivals(partyId: string) {
  const ms = await prisma.partyMember.findMany({ where: { partyId }, include: { user: { select: { id: true, name: true, avatarColor: true, isSimulated: true, isLive: true } } }, orderBy: { joinedAt: "asc" } });
  return ms.map((m) => ({ ...m.user, checkedInAt: m.checkedInAt?.toISOString() ?? null, photoUrl: m.photoOptIn ? m.photoUrl : null }));
}
