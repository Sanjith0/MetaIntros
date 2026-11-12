import { NextResponse } from "next/server";
import { z } from "zod";
import { spotByTap } from "@/lib/server/door";
import { currentViewerId } from "@/lib/server/viewer";

const Body = z.object({ partyId: z.string(), subjectId: z.string() });

export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  try {
    return NextResponse.json(spotByTap(body.data.partyId, await currentViewerId(), body.data.subjectId));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
