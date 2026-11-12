import { NextResponse } from "next/server";
import { fastForward } from "@/lib/server/expiry";
import { getCurrentUserId } from "@/lib/server/session";

export async function POST() {
  const r = await fastForward(await getCurrentUserId());
  return NextResponse.json(r, { status: r.ok ? 200 : 404 });
}
