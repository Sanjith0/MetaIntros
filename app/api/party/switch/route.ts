import { NextResponse } from "next/server";
import { z } from "zod";
import { askToSwitch } from "@/lib/server/switchplan";
import { currentViewerId } from "@/lib/server/viewer";

const Body = z.object({ partyId: z.string() });

/** Ask to switch to plan B. Three of five, and code switches. */
export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  try {
    return NextResponse.json(askToSwitch(body.data.partyId, await currentViewerId()));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
