import { NextResponse } from "next/server";
import { flag } from "@/lib/flags";
import { runPreflight } from "@/lib/server/preflight";

export const dynamic = "force-dynamic";

/** Read-only: checks settings and rehearses the demo party in a sandbox. */
export async function POST() {
  if (!flag("PREFLIGHT")) return NextResponse.json({ error: "off" }, { status: 404 });
  return NextResponse.json(await runPreflight());
}
