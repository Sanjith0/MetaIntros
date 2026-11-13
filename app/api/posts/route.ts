import { NextResponse } from "next/server";
import { createPost } from "@/lib/server/posts";
import { getCurrentUserId } from "@/lib/server/session";

export const dynamic = "force-dynamic";

/** Create a post or story. Audience, consent and squad membership are checked in lib/server/posts.ts. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "bad_body" }, { status: 400 });
  const r = await createPost(await getCurrentUserId(), body);
  return NextResponse.json(r, { status: r.ok ? 200 : r.error === "not_found" ? 404 : r.error === "photo_not_allowed" ? 403 : 400 });
}
