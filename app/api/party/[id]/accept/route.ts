import { NextResponse } from "next/server";
import { acceptParty } from "@/lib/server/readyCheck";
import { getCurrentUserId } from "@/lib/server/session";

export const dynamic = "force-dynamic";

/** Ready check: "I'm in". */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await acceptParty(await getCurrentUserId(), id);
  return NextResponse.json(r, { status: r.ok ? 200 : r.error === "not_found" ? 404 : 409 });
}
