import { NextResponse } from "next/server";
import { z } from "zod";
import { frameSource, setFrameSource } from "@/lib/door/source";

export const dynamic = "force-dynamic";

const Body = z.object({ source: z.enum(["fixture", "tap-only"]) });

export function GET() {
  return NextResponse.json({ source: frameSource() });
}

export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "unknown frame source" }, { status: 400 });
  setFrameSource(body.data.source);
  return NextResponse.json({ source: frameSource() });
}
