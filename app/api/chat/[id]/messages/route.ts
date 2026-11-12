import { NextResponse } from "next/server";
import { z } from "zod";
import { postMessage } from "@/lib/server/social";
import { currentViewerId } from "@/lib/server/viewer";

const Body = z.object({ text: z.string().trim().min(1).max(1000) });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const viewer = await currentViewerId();
  try {
    const msg = postMessage(id, viewer, body.data.text);
    return NextResponse.json({ ok: true, message: msg });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }
}
