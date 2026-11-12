import { NextResponse } from "next/server";
import { z } from "zod";
import { setMeetSpot } from "@/lib/server/meet";
import { currentViewerId } from "@/lib/server/viewer";

const Body = z.object({ partyId: z.string(), text: z.string() });

/** "Where we meet": your words, to your party's chat and door screens. */
export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  try {
    setMeetSpot(body.data.partyId, await currentViewerId(), body.data.text);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
