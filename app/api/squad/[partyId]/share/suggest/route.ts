import { NextResponse } from "next/server";
import { suggestPost } from "@/lib/server/posts";
import { now } from "@/lib/server/clock";
import { getCurrentUserId } from "@/lib/server/session";

export const dynamic = "force-dynamic";

/** "Let AI suggest a post": returns a draft only. Nothing is posted until the user taps Share. */
export async function POST(_req: Request, { params }: { params: Promise<{ partyId: string }> }) {
  const { partyId } = await params;
  const r = await suggestPost(partyId, await getCurrentUserId(), await now());
  return NextResponse.json(r, { status: r.ok ? 200 : r.error === "not_found" ? 404 : 409 });
}
