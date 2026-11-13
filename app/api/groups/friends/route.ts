import { NextResponse } from "next/server";
import { friendsForQueue } from "@/lib/server/queueGroups";
import { getCurrentUserId } from "@/lib/server/session";

export const dynamic = "force-dynamic";

/** Your friends for the "Add friends" list, each with the reason they can't come (if any). */
export async function GET() {
  return NextResponse.json({ friends: await friendsForQueue(await getCurrentUserId()) });
}
