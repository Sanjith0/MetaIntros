import { NextResponse } from "next/server";
import { tick } from "@/lib/server/queue";

/** Force a matchmaking pass (demo panel + tests). */
export async function POST() {
  return NextResponse.json({ formed: await tick() });
}
