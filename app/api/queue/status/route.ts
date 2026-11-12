import { NextResponse } from "next/server";
import { getQueueStatus } from "@/lib/server/queue";
import { getCurrentUserId } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getQueueStatus(await getCurrentUserId()));
}
