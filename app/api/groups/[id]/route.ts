import { NextResponse } from "next/server";
import { getGroupView } from "@/lib/server/queueGroups";
import { getCurrentUserId } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = await getGroupView(await getCurrentUserId(), id);
  if (!v) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(v);
}
