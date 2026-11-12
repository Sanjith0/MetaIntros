import { NextResponse } from "next/server";
import { z } from "zod";
import { leaveParty } from "@/lib/server/leave";
import { currentViewerId } from "@/lib/server/viewer";

const Body = z.object({ partyId: z.string() });

/** Leave before the plan is locked. The others are not told who left. */
export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, ...(await leaveParty(body.data.partyId, await currentViewerId())) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
