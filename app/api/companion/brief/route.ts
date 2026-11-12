import { NextResponse } from "next/server";
import { getBriefFor } from "@/lib/server/briefs";
import { getCurrentUserId } from "@/lib/server/session";

export const dynamic = "force-dynamic";

/** What the current user's Companion knows and may share (never a model call, never a sensitive item). */
export async function GET() {
  const brief = await getBriefFor(await getCurrentUserId(), { mode: "events", eventTitle: null, targetSize: 6 }, false);
  if (!brief) return NextResponse.json({ error: "no_profile" }, { status: 404 });
  return NextResponse.json({ facts: brief.facts, communication: brief.communication });
}
