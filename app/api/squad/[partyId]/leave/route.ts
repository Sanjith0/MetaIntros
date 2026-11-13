import { NextResponse } from "next/server";
import { leaveSquad } from "@/lib/server/squads";
import { getCurrentUserId } from "@/lib/server/session";

export const dynamic = "force-dynamic";

/** Leave a squad you're in: you leave its chat and plan; the others see that you left, not why. */
export async function POST(_req: Request, { params }: { params: Promise<{ partyId: string }> }) {
  const { partyId } = await params;
  const r = await leaveSquad(await getCurrentUserId(), partyId);
  return NextResponse.json(r, { status: r.ok ? 200 : r.error === "not_found" ? 404 : 409 });
}
