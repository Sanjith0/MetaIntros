import { NextResponse } from "next/server";
import { z } from "zod";
import { addAlbumPhoto, listAlbum } from "@/lib/server/album";
import { getCurrentUserId } from "@/lib/server/session";

export const dynamic = "force-dynamic";

/** Squad album: members of a ready squad only; everyone else gets 404 (no existence leak). */
export async function GET(_req: Request, { params }: { params: Promise<{ partyId: string }> }) {
  const { partyId } = await params;
  const a = await listAlbum(partyId, await getCurrentUserId());
  if (!a) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(a, { headers: { "Cache-Control": "private, no-store" } });
}

const Body = z.object({ dataUrl: z.string(), caption: z.string().nullish(), shareable: z.boolean().optional() });

export async function POST(req: Request, { params }: { params: Promise<{ partyId: string }> }) {
  const { partyId } = await params;
  const p = Body.safeParse(await req.json().catch(() => ({})));
  if (!p.success) return NextResponse.json({ ok: false, error: "bad_body" }, { status: 400 });
  const r = await addAlbumPhoto(partyId, await getCurrentUserId(), p.data);
  return NextResponse.json(r, { status: r.ok ? 200 : r.error === "not_found" ? 404 : r.error === "album_full" ? 409 : 400 });
}
