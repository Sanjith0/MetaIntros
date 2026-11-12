import { NextResponse } from "next/server";
import { z } from "zod";
import { setRsvp } from "@/lib/server/social";
import { currentViewerId } from "@/lib/server/viewer";

const Body = z.object({ eventId: z.string(), status: z.enum(["interested", "going"]).nullable() });

export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const viewer = await currentViewerId();
  try {
    setRsvp(body.data.eventId, viewer, body.data.status);
  } catch {
    return NextResponse.json({ error: "unknown event" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
