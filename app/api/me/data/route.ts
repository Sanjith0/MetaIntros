import { NextResponse } from "next/server";
import { flag } from "@/lib/flags";
import { myData } from "@/lib/server/mydata";
import { currentViewerId } from "@/lib/server/viewer";

export const dynamic = "force-dynamic";

/** Your data, as a file. Only ever your own. */
export async function GET() {
  if (!flag("MY_DATA")) return NextResponse.json({ error: "off" }, { status: 404 });
  const viewer = await currentViewerId();
  return new NextResponse(JSON.stringify({ exportedAt: new Date().toISOString(), note: "Hackathon prototype: fictional data.", ...myData(viewer) }, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="party-queue-${viewer}.json"` },
  });
}
