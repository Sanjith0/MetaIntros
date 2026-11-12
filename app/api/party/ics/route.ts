import { NextResponse } from "next/server";
import { flag } from "@/lib/flags";
import { partyIcs } from "@/lib/server/ics";
import { partyForViewer } from "@/lib/server/social";
import { currentViewerId } from "@/lib/server/viewer";

export const dynamic = "force-dynamic";

/** Your locked plan as an .ics file. */
export async function GET() {
  if (!flag("ADD_TO_CALENDAR")) return NextResponse.json({ error: "off" }, { status: 404 });
  const viewer = await currentViewerId();
  const party = partyForViewer(viewer);
  const ics = party ? partyIcs(party.id, viewer) : null;
  if (!ics) return NextResponse.json({ error: "No plan to add yet." }, { status: 404 });
  return new NextResponse(ics.body, { headers: { "content-type": "text/calendar; charset=utf-8", "content-disposition": `attachment; filename="${ics.filename}"` } });
}
