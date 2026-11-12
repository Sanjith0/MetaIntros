import { NextResponse } from "next/server";
import { DEMO_PARTY } from "@/fixtures";
import { store } from "@/lib/server/store";
import { VIEWER_COOKIE } from "@/lib/server/viewer";

export const dynamic = "force-dynamic";

/** A phone scans a QR code and becomes that demo person. No login: it is
 *  the user switcher, reached from a camera instead of a menu. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  if (!store().profiles.has(id)) return NextResponse.redirect(new URL("/events", url));
  const next = id === "maya" ? `/event/${DEMO_PARTY.entryEventId}` : "/events";
  const res = NextResponse.redirect(new URL(next, url));
  res.cookies.set(VIEWER_COOKIE, id, { path: "/", sameSite: "lax" });
  return res;
}
