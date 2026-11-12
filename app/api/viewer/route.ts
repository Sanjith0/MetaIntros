import { NextResponse } from "next/server";
import { z } from "zod";
import { store } from "@/lib/server/store";
import { VIEWER_COOKIE } from "@/lib/server/viewer";

const Body = z.object({ id: z.string() });

export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success || !store().profiles.has(body.data.id)) {
    return NextResponse.json({ error: "unknown user" }, { status: 400 });
  }
  const res = NextResponse.json({ ok: true, id: body.data.id });
  res.cookies.set(VIEWER_COOKIE, body.data.id, { path: "/", sameSite: "lax", httpOnly: false });
  return res;
}
