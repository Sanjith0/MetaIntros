import { NextResponse } from "next/server";
import { flag } from "@/lib/flags";
import { publicStageView, stageView } from "@/lib/server/views";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const u = new URL(req.url);
  const party = u.searchParams.get("party") ?? undefined;
  // F46: the room's view: nothing personal leaves the server.
  if (u.searchParams.get("public") === "1" && flag("FOLLOW_ALONG")) return NextResponse.json(publicStageView(party));
  return NextResponse.json(stageView(party));
}
