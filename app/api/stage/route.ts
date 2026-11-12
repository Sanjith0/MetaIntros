import { NextResponse } from "next/server";
import { stageView } from "@/lib/server/views";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const party = new URL(req.url).searchParams.get("party") ?? undefined;
  return NextResponse.json(stageView(party));
}
