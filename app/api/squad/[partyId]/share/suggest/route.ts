import { NextResponse } from "next/server";
import { suggestPost } from "@/lib/server/posts";
import { now } from "@/lib/server/clock";
import { getCurrentUserId } from "@/lib/server/session";

export const dynamic = "force-dynamic";

/** Post ideas after the event: a squad chat recap and up to 3 drafts. Nothing is posted until the user taps Share. */
export async function POST(_req: Request, { params }: { params: Promise<{ partyId: string }> }) {
  const { partyId } = await params;
  const r = await suggestPost(partyId, await getCurrentUserId(), await now());
  return NextResponse.json(r, { status: r.ok ? 200 : r.error === "not_found" ? 404 : 409 });
}
