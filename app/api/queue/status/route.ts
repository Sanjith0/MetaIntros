import { NextResponse } from "next/server";
import { queueStatus } from "@/lib/server/queue";
import { currentViewerId } from "@/lib/server/viewer";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ status: queueStatus(await currentViewerId()) });
}
