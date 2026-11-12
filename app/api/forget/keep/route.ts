import { NextResponse } from "next/server";
import { z } from "zod";
import { setKeepNight } from "@/lib/server/forget";
import { currentViewerId } from "@/lib/server/viewer";

const Body = z.object({ partyId: z.string(), keep: z.boolean() });

/** F43: keep your private data after the night instead of having it deleted automatically. */
export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  try {
    setKeepNight(body.data.partyId, await currentViewerId(), body.data.keep);
    return NextResponse.json({ ok: true, keep: body.data.keep });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
