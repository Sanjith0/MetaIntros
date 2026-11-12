import { NextResponse } from "next/server";
import { queueStatus, widenToNight } from "@/lib/server/queue";
import { currentViewerId } from "@/lib/server/viewer";

/** Widen your own search to anywhere tonight; your place in line stays. */
export async function POST() {
  const viewer = await currentViewerId();
  try {
    const r = await widenToNight(viewer);
    return NextResponse.json({ ok: true, partyId: r.partyId, status: queueStatus(viewer) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
