import { NextResponse } from "next/server";
import { leaveQueue } from "@/lib/server/queue";
import { getCurrentUserId } from "@/lib/server/session";

export async function POST() {
  await leaveQueue(await getCurrentUserId());
  return NextResponse.json({ ok: true });
}
