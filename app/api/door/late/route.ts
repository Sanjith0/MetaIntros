import { NextResponse } from "next/server";
import { z } from "zod";
import { runningLate } from "@/lib/server/meet";
import { currentViewerId } from "@/lib/server/viewer";

const Body = z.object({ partyId: z.string(), minutes: z.number().int() });

/** "Running late": tells your party, in the chat and on their door screens. */
export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  try {
    runningLate(body.data.partyId, await currentViewerId(), body.data.minutes);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
