import { NextResponse } from "next/server";
import { decodeDataUrl } from "@/lib/server/album";
import { getPostPhotoData } from "@/lib/server/posts";
import { now } from "@/lib/server/clock";
import { getCurrentUserId } from "@/lib/server/session";

export const dynamic = "force-dynamic";

/**
 * A photo as part of a post. Served only if the viewer can see that post (audience, blocks, story
 * expiry) AND the photo is still allowed (uploader's consent). Never exposes the rest of the album.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ postId: string; photoId: string }> }) {
  const { postId, photoId } = await params;
  const url = await getPostPhotoData(await getCurrentUserId(), postId, photoId, await now());
  const img = url ? decodeDataUrl(url) : null;
  if (!img) return NextResponse.json({ error: "not found" }, { status: 404 });
  return new Response(new Uint8Array(img.bytes), { headers: { "Content-Type": img.mime, "Cache-Control": "private, no-store" } });
}
