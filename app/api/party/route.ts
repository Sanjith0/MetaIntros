import { NextResponse } from "next/server";
import { currentViewerId } from "@/lib/server/viewer";
import { memberPartyViewForViewer } from "@/lib/server/views";

export const dynamic = "force-dynamic";

/** The viewer's own party view: public table, own pairs, own receipt and cards. */
export async function GET() {
  return NextResponse.json({ view: memberPartyViewForViewer(await currentViewerId()) });
}
