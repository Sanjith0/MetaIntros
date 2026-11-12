import { NextResponse } from "next/server";
import { z } from "zod";
import { setBlock } from "@/lib/server/safety";
import { currentViewerId } from "@/lib/server/viewer";

const Body = z.object({ subjectId: z.string(), on: z.boolean() });

export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  try {
    return NextResponse.json({ blocks: setBlock(await currentViewerId(), body.data.subjectId, body.data.on) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
