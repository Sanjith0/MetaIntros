import { NextResponse } from "next/server";
import { z } from "zod";
import { decodeDataUrl, deleteAlbumPhoto, getAlbumPhotoData, updateAlbumPhoto } from "@/lib/server/album";
import { getCurrentUserId } from "@/lib/server/session";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ partyId: string; photoId: string }> };
const notFound = () => NextResponse.json({ error: "not found" }, { status: 404 });

/** One album photo: squad members only (404 for anyone else, like the find-me photos). */
export async function GET(_req: Request, { params }: Ctx) {
  const { partyId, photoId } = await params;
  const url = await getAlbumPhotoData(partyId, await getCurrentUserId(), photoId);
  const img = url ? decodeDataUrl(url) : null;
  if (!img) return notFound();
  return new Response(new Uint8Array(img.bytes), { headers: { "Content-Type": img.mime, "Cache-Control": "private, no-store" } });
}

const Patch = z.object({ shareable: z.boolean().optional(), caption: z.string().nullish() });

/** Uploader only: consent flag ("Squadmates can include this in a post") or caption. */
export async function PATCH(req: Request, { params }: Ctx) {
  const { partyId, photoId } = await params;
  const p = Patch.safeParse(await req.json().catch(() => ({})));
  if (!p.success) return NextResponse.json({ ok: false, error: "bad_body" }, { status: 400 });
  const r = await updateAlbumPhoto(partyId, await getCurrentUserId(), photoId, p.data);
  return NextResponse.json(r, { status: r.ok ? 200 : r.error === "not_found" ? 404 : 400 });
}

/** Uploader only; always works, even after the squad chat ends. */
export async function DELETE(_req: Request, { params }: Ctx) {
  const { partyId, photoId } = await params;
  const r = await deleteAlbumPhoto(partyId, await getCurrentUserId(), photoId);
  return NextResponse.json(r, { status: r.ok ? 200 : 404 });
}
