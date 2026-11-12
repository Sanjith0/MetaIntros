import { NextResponse } from "next/server";
import { flag } from "@/lib/flags";
import { tryLeak } from "@/lib/server/attempt";
import { store } from "@/lib/server/store";

export const dynamic = "force-dynamic";

/** The projector's "Try to leak it": runs a typed line through the verifier. Posts nothing. */
export async function POST(req: Request) {
  if (!flag("LEAK_TEST")) return NextResponse.json({ error: "off" }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { partyId?: string; actorId?: string; text?: string };
  const partyId = body.partyId || [...store().parties.keys()].at(-1) || "";
  const r = tryLeak(partyId, String(body.actorId ?? ""), String(body.text ?? ""));
  if (!r) return NextResponse.json({ error: "no such party member, or nothing typed" }, { status: 400 });
  return NextResponse.json(r);
}
