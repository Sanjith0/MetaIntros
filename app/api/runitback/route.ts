import { NextResponse } from "next/server";
import { z } from "zod";
import { runItBackView, submitPicks } from "@/lib/server/after";
import { currentViewerId } from "@/lib/server/viewer";

const Body = z.object({ partyId: z.string(), pickedIds: z.array(z.string()).max(4) });

export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const viewer = await currentViewerId();
  try {
    submitPicks(body.data.partyId, viewer, body.data.pickedIds);
    return NextResponse.json({ ok: true, view: runItBackView(body.data.partyId, viewer) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
