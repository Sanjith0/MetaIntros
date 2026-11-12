import { NextResponse } from "next/server";
import { getPartyPhoto } from "@/lib/server/companion";
import { getCurrentUserId } from "@/lib/server/session";

export const dynamic = "force-dynamic";

/** Party-scoped photo: 404 for anyone outside the party (no existence leak). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; userId: string }> }) {
  const { id, userId } = await params;
  const url = await getPartyPhoto(id, await getCurrentUserId(), userId);
  if (!url) return NextResponse.json({ error: "not found" }, { status: 404 });
  const [, mime, b64] = url.match(/^data:(image\/\w+);base64,(.+)$/)!;
  return new Response(Buffer.from(b64, "base64"), { headers: { "Content-Type": mime, "Cache-Control": "private, no-store" } });
}
