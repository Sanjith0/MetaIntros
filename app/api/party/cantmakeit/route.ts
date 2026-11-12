import { NextResponse } from "next/server";
import { z } from "zod";
import { cantMakeIt } from "@/lib/server/refill";
import { currentViewerId } from "@/lib/server/viewer";

const Body = z.object({ partyId: z.string() });

/** After the lock: you can't make it. The others aren't told who. */
export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  try {
    const r = await cantMakeIt(body.data.partyId, await currentViewerId());
    return NextResponse.json({ ok: true, refilled: r.joined !== null });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
