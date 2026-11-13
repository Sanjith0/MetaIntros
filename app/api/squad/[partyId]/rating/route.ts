import { NextResponse } from "next/server";
import { z } from "zod";
import { getRatingState, skipRating, submitRating } from "@/lib/server/ratings";
import { getCurrentUserId } from "@/lib/server/session";

export const dynamic = "force-dynamic";

/** Your own rating state for this squad (never anyone else's answers). */
export async function GET(_req: Request, { params }: { params: Promise<{ partyId: string }> }) {
  const { partyId } = await params;
  const s = await getRatingState(partyId, await getCurrentUserId());
  return s ? NextResponse.json(s, { headers: { "Cache-Control": "private, no-store" } }) : NextResponse.json({ error: "not found" }, { status: 404 });
}

const Body = z.union([
  z.object({ skip: z.literal(true) }),
  z.object({ stars: z.number().int().min(1).max(5), mates: z.record(z.string(), z.enum(["again", "not_again"])).default({}) }),
]);

/** Rate the night (and optionally each squadmate), or "Not now". */
export async function POST(req: Request, { params }: { params: Promise<{ partyId: string }> }) {
  const { partyId } = await params;
  const p = Body.safeParse(await req.json().catch(() => ({})));
  if (!p.success) return NextResponse.json({ ok: false, error: "bad_body" }, { status: 400 });
  const userId = await getCurrentUserId();
  const r = "skip" in p.data ? await skipRating(partyId, userId) : await submitRating(partyId, userId, p.data);
  return NextResponse.json(r, { status: r.ok ? 200 : r.error === "not_found" ? 404 : r.error === "not_ended" ? 409 : 400 });
}
