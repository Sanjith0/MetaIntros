import { NextResponse } from "next/server";
import frame from "@/fixtures/frames/dev-at-door.json";
import { spotFromFrame } from "@/lib/server/door";
import { partyForViewer } from "@/lib/server/social";

export const dynamic = "force-dynamic";

/** Demo helper: posts fixtures/frames/dev-at-door.json for the viewer's party. */
export async function POST() {
  const party = partyForViewer(frame.viewerId);
  if (!party) return NextResponse.json({ error: "no party for the frame's viewer yet" }, { status: 400 });
  try {
    return NextResponse.json(await spotFromFrame({ ...frame, partyId: party.id }));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
