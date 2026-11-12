import { NextResponse } from "next/server";
import { getBadges } from "@/lib/server/badges";
import { getCurrentUserId } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getBadges(await getCurrentUserId()));
}
