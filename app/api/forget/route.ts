import { NextResponse } from "next/server";
import { canForget, forgetNight } from "@/lib/server/forget";
import { currentViewerId } from "@/lib/server/viewer";

export const dynamic = "force-dynamic";

/** Forget the viewer's own private data from one party. Only ever the viewer's own. */
export async function POST(req: Request) {
  const viewer = await currentViewerId();
  const body = (await req.json().catch(() => ({}))) as { partyId?: string };
  const partyId = String(body.partyId ?? "");
  const why = canForget(partyId, viewer);
  if (why) return NextResponse.json({ error: why }, { status: 400 });
  return NextResponse.json(forgetNight(partyId, viewer));
}
