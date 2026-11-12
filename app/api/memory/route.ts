import { NextResponse } from "next/server";
import { z } from "zod";
import { forgetMemory, memoryOf, remember } from "@/lib/server/memory";
import { currentViewerId } from "@/lib/server/viewer";

export const dynamic = "force-dynamic";

const Body = z.object({ partyId: z.string(), feeling: z.enum(["loved", "loud", "meh"]), tags: z.array(z.string()).max(12) });

/** Only ever your own memory. */
export async function GET() {
  return NextResponse.json({ memory: memoryOf(await currentViewerId()) });
}

export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  try {
    return NextResponse.json({ memory: remember(body.data.partyId, await currentViewerId(), body.data.feeling, body.data.tags) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function DELETE() {
  forgetMemory(await currentViewerId());
  return NextResponse.json({ memory: [] });
}
