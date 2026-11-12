import { NextResponse } from "next/server";
import { z } from "zod";
import { playClip } from "@/lib/door/clip";
import { frameSource } from "@/lib/door/source";
import { partyForViewer } from "@/lib/server/social";

export const dynamic = "force-dynamic";

const Body = z.object({ viewerId: z.string().default("maya"), speed: z.number().min(0.25).max(20).default(1) });

/** Play the recorded clip of arrivals into a viewer's door (and glasses). */
export async function POST(req: Request) {
  const body = Body.parse(await req.json().catch(() => ({})));
  if (frameSource() !== "recorded-clip") return NextResponse.json({ error: "switch the frame source to the recorded clip first" }, { status: 409 });
  const party = partyForViewer(body.viewerId);
  if (!party || party.status !== "locked") return NextResponse.json({ error: "no locked party for that viewer" }, { status: 400 });
  return NextResponse.json({ ok: true, ...playClip(body.viewerId, party.id, { speed: body.speed }) });
}
