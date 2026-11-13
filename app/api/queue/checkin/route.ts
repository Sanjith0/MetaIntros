import { NextResponse } from "next/server";
import { answerCheckIn } from "@/lib/server/rooms";
import { getCurrentUserId } from "@/lib/server/session";

/** Answer your own Companion's check-in: who to drop and what it got wrong, or your yes/no on a squad. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { id?: unknown; drop?: unknown; told?: unknown; decision?: unknown };
  if (typeof body.id !== "string") return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  const r = await answerCheckIn(await getCurrentUserId(), body.id, body);
  if (!r.ok) return NextResponse.json(r, { status: r.error === "not_found" ? 404 : 422 });
  return NextResponse.json(r);
}
