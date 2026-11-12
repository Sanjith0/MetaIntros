import { NextResponse } from "next/server";
import { arrivals, checkIn, isPartyMember, simulateArrivals } from "@/lib/server/companion";
import { getCurrentUserId } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await checkIn(id, await getCurrentUserId());
  if (r.ok) simulateArrivals(id).catch(() => {});
  return NextResponse.json(r, { status: r.ok ? 200 : 403 });
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await isPartyMember(id, await getCurrentUserId()))) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(await arrivals(id));
}
