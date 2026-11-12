import { NextResponse } from "next/server";
import { z } from "zod";
import { postMessage } from "@/lib/server/messages";
import { getCurrentUserId } from "@/lib/server/session";
import { afterUserMessage } from "@/lib/server/host";

const Body = z.object({ body: z.string().min(1).max(2000) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = Body.safeParse(await req.json().catch(() => ({})));
  if (!p.success) return NextResponse.json({ ok: false, error: "empty" }, { status: 400 });
  const userId = await getCurrentUserId();
  const r = await postMessage(id, userId, p.data.body);
  if (!r.ok) return NextResponse.json(r, { status: r.error === "archived" ? 409 : 403 });
  afterUserMessage(id, userId, p.data.body).catch((e) => console.error("[host]", e));
  return NextResponse.json(r);
}
