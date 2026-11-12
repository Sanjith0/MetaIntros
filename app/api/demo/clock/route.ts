import { NextResponse } from "next/server";
import { z } from "zod";
import { clockOffset, demoNow, setDemoNow } from "@/lib/server/clock";
import { store } from "@/lib/server/store";

export const dynamic = "force-dynamic";

const Body = z.object({ to: z.enum(["after-event", "now"]) });

/** Demo clock: jump past the event (so party chats close), or back to now. */
export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  if (body.data.to === "now") setDemoNow(null);
  else {
    const expiries = [...store().chats.values()].map((c) => c.expiresAt).filter((x): x is string => !!x).sort();
    const target = expiries.at(-1) ?? "2026-11-15T18:00:00.000Z";
    setDemoNow(new Date(Date.parse(target) + 60_000).toISOString());
  }
  return NextResponse.json({ now: new Date(demoNow()).toISOString(), offsetMs: clockOffset() });
}

export function GET() {
  return NextResponse.json({ now: new Date(demoNow()).toISOString(), offsetMs: clockOffset() });
}
