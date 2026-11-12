import { NextResponse } from "next/server";
import { z } from "zod";
import { askToJoin, cancelGroup, leaveGroup, respondToInvite, startGroup } from "@/lib/server/queueGroups";
import { getCurrentUserId } from "@/lib/server/session";

export const dynamic = "force-dynamic";

const Respond = z.object({ accept: z.boolean() });

/**
 * POST /api/groups/[id]/respond {accept} · /start (host) · /cancel (host) · /leave · /join (a friend of
 * the host asks to come along while the host is still waiting for friends).
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string; action: string }> }) {
  const { id, action } = await params;
  const userId = await getCurrentUserId();
  let r: { ok: boolean; error?: string };
  switch (action) {
    case "respond": {
      const p = Respond.safeParse(await req.json().catch(() => ({})));
      if (!p.success) return NextResponse.json({ ok: false, error: "bad_body" }, { status: 400 });
      r = await respondToInvite(userId, id, p.data.accept);
      break;
    }
    case "start":
      r = await startGroup(userId, id);
      break;
    case "cancel":
      r = await cancelGroup(userId, id);
      break;
    case "leave":
      r = await leaveGroup(userId, id);
      break;
    case "join":
      r = await askToJoin(userId, id);
      break;
    default:
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  return NextResponse.json(r, { status: r.ok ? 200 : r.error === "not_found" ? 404 : 409 });
}
