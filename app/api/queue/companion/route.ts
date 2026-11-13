import { NextResponse } from "next/server";
import { liveViewFor } from "@/lib/server/rooms";
import { getCurrentUserId } from "@/lib/server/session";

export const dynamic = "force-dynamic";

/** What the current user's Companion is doing right now: only its own conversations and notes. */
export async function GET() {
  const view = await liveViewFor(await getCurrentUserId());
  return NextResponse.json(view ?? { stage: null });
}
