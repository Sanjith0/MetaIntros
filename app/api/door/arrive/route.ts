import { NextResponse } from "next/server";
import { z } from "zod";
import { arrive } from "@/lib/server/door";
import { currentViewerId } from "@/lib/server/viewer";

const Body = z.object({ partyId: z.string() });

export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  try {
    arrive(body.data.partyId, await currentViewerId());
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
