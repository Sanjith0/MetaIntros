import { NextResponse } from "next/server";
import { fairStats } from "@/lib/server/fair";

export const dynamic = "force-dynamic";

/** Live counts for the fair host. Counts only, no names. */
export function GET() {
  return NextResponse.json(fairStats());
}
