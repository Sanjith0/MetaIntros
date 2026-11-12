import { NextResponse } from "next/server";
import { z } from "zod";
import { respondToRequest } from "@/lib/server/friending";
import { getCurrentUserId } from "@/lib/server/session";

const Body = z.object({ requestId: z.string(), accept: z.boolean() });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "bad body" }, { status: 400 });
  const r = await respondToRequest(await getCurrentUserId(), parsed.data.requestId, parsed.data.accept);
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
