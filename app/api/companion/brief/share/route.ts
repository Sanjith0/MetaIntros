import { NextResponse } from "next/server";
import { setShare } from "@/lib/server/briefs";
import { getCurrentUserId } from "@/lib/server/session";

/** The user chooses what their Companion may say about them. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { factId?: unknown; share?: unknown };
  if (typeof body.factId !== "string") return NextResponse.json({ ok: false, error: "unknown_fact" }, { status: 404 });
  const r = await setShare(await getCurrentUserId(), body.factId, body.share);
  if (!r.ok) return NextResponse.json(r, { status: r.error === "bad_share" ? 422 : 404 });
  return NextResponse.json(r);
}
