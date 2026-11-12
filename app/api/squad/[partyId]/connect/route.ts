import { NextResponse } from "next/server";
import { z } from "zod";
import { sendSquadRequest, squadConnectState } from "@/lib/server/friending";
import { getCurrentUserId } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ partyId: string }> }) {
  const { partyId } = await params;
  const s = await squadConnectState(await getCurrentUserId(), partyId);
  return s ? NextResponse.json(s) : NextResponse.json({ error: "not found" }, { status: 404 });
}

export async function POST(req: Request, { params }: { params: Promise<{ partyId: string }> }) {
  const { partyId } = await params;
  const p = z.object({ toId: z.string() }).safeParse(await req.json().catch(() => ({})));
  if (!p.success) return NextResponse.json({ ok: false, error: "bad_body" }, { status: 400 });
  const r = await sendSquadRequest(await getCurrentUserId(), p.data.toId, partyId);
  return NextResponse.json(r, { status: r.ok ? 200 : 409 });
}
