import { NextResponse } from "next/server";
import { z } from "zod";
import { setPartyPhoto } from "@/lib/server/companion";
import { getCurrentUserId } from "@/lib/server/session";

const Body = z.object({ dataUrl: z.string().nullable() });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = Body.safeParse(await req.json().catch(() => ({})));
  if (!p.success) return NextResponse.json({ ok: false, error: "bad_body" }, { status: 400 });
  const r = await setPartyPhoto(id, await getCurrentUserId(), p.data.dataUrl);
  return NextResponse.json(r, { status: r.ok ? 200 : r.error === "not_member" ? 403 : 400 });
}
