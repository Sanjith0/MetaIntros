import { NextResponse } from "next/server";
import { z } from "zod";
import { joinQueue } from "@/lib/server/queue";
import { currentViewerId } from "@/lib/server/viewer";

const Body = z.object({
  eventId: z.string(),
  sentence: z.string().trim().min(3).max(280),
  consentBridges: z.boolean(),
  approvedLineIds: z.array(z.string()).optional(),
  duoWith: z.string().nullable().optional(),
  scope: z.enum(["event", "night"]).optional(),
  settings: z.object({ womenOnly: z.boolean(), notOnlyWoman: z.boolean() }).optional(),
});

export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Type one sentence about your night." }, { status: 400 });
  const viewer = await currentViewerId();
  try {
    const res = await joinQueue({ userId: viewer, ...body.data });
    return NextResponse.json({ ok: true, entryId: res.entry.id, partyId: res.partyId });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
