import { NextResponse } from "next/server";
import { z } from "zod";
import frame from "@/fixtures/frames/dev-at-door.json";
import { FIXTURE_FRAMES } from "@/fixtures/demo";
import { frameSource } from "@/lib/door/source";
import { spotFromFrame } from "@/lib/server/door";
import { partyForViewer } from "@/lib/server/social";

export const dynamic = "force-dynamic";

const Body = z.object({ subjectId: z.string().default("dev"), viewerId: z.string().default(frame.viewerId) });

/** Demo helper: send a fixture frame (default fixtures/frames/dev-at-door.json) to a viewer's door. */
export async function POST(req: Request) {
  const body = Body.parse(await req.json().catch(() => ({})));
  if (frameSource() !== "fixture") return NextResponse.json({ error: "the door camera is off (tap-only)" }, { status: 409 });
  const key = `door-frame-${body.subjectId}`;
  if (!FIXTURE_FRAMES[key]) return NextResponse.json({ error: "no fixture frame for that person" }, { status: 400 });
  const party = partyForViewer(body.viewerId);
  if (!party) return NextResponse.json({ error: "no party for that viewer yet" }, { status: 400 });
  try {
    return NextResponse.json(await spotFromFrame({ ...frame, id: `frame-${Date.now()}`, viewerId: body.viewerId, fixtureKey: key, partyId: party.id }));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
