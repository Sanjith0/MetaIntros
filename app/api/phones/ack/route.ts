import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAck } from "@/lib/server/phones";
import { currentViewerId } from "@/lib/server/viewer";

const Body = z.object({ partyId: z.string(), shownAt: z.number(), sound: z.string().max(20), vibrate: z.string().max(20) });

/** A phone reports when it actually showed MATCH FOUND (server clock). */
export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const ack = recordAck({ userId: await currentViewerId(), ...body.data });
  return ack ? NextResponse.json({ ok: true, lagMs: ack.lagMs }) : NextResponse.json({ error: "no locked party" }, { status: 400 });
}
