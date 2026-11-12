import { NextResponse } from "next/server";
import { kickLiveUsers } from "@/lib/server/demo";

export async function POST() {
  return NextResponse.json({ ok: true, removed: await kickLiveUsers() });
}
