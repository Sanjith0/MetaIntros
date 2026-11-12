import { NextResponse } from "next/server";
import { leaveQueue } from "@/lib/server/queue";
import { currentViewerId } from "@/lib/server/viewer";

export async function POST() {
  leaveQueue(await currentViewerId());
  return NextResponse.json({ ok: true });
}
