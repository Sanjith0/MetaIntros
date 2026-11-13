import { NextResponse } from "next/server";
import { z } from "zod";
import { declineShare, shareState } from "@/lib/server/posts";
import { now } from "@/lib/server/clock";
import { getCurrentUserId } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ partyId: string }> }) {
  const { partyId } = await params;
  const s = await shareState(partyId, await getCurrentUserId(), await now());
  return s ? NextResponse.json(s, { headers: { "Cache-Control": "private, no-store" } }) : NextResponse.json({ error: "not found" }, { status: 404 });
}

/** "Don't post": remembered so the prompt stops showing. */
export async function POST(req: Request, { params }: { params: Promise<{ partyId: string }> }) {
  const { partyId } = await params;
  const p = z.object({ choice: z.literal("none") }).safeParse(await req.json().catch(() => ({})));
  if (!p.success) return NextResponse.json({ ok: false, error: "bad_body" }, { status: 400 });
  const r = await declineShare(partyId, await getCurrentUserId(), await now());
  return NextResponse.json(r, { status: r.ok ? 200 : r.error === "not_found" ? 404 : 409 });
}
