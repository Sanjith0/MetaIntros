import { NextResponse } from "next/server";
import { z } from "zod";
import { revokeFact } from "@/lib/server/revoke";
import { currentViewerId } from "@/lib/server/viewer";

const Body = z.object({ factId: z.string() });

/** Stop sharing one of your own facts. */
export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  try {
    return NextResponse.json(revokeFact(await currentViewerId(), body.data.factId));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
