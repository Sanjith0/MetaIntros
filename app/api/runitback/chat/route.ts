import { NextResponse } from "next/server";
import { z } from "zod";
import { pairChat } from "@/lib/server/after";
import { currentViewerId } from "@/lib/server/viewer";

const Body = z.object({ partyId: z.string(), otherId: z.string() });

/** Open (or create) the private chat for a mutual pair. */
export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  try {
    return NextResponse.json({ chatId: pairChat(body.data.partyId, await currentViewerId(), body.data.otherId) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }
}
