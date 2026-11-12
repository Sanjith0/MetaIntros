import { NextResponse } from "next/server";
import { declineParty } from "@/lib/server/readyCheck";
import { getCurrentUserId } from "@/lib/server/session";

export const dynamic = "force-dynamic";

/** Ready check: "Not for me". The rest of the squad goes back into the queue. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await declineParty(await getCurrentUserId(), id);
  return NextResponse.json(r, { status: r.ok ? 200 : r.error === "not_found" ? 404 : 409 });
}
