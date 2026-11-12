import { NextResponse } from "next/server";
import { resetStore } from "@/lib/server/store";

export const dynamic = "force-dynamic";

export function POST() {
  const s = resetStore();
  return NextResponse.json({ ok: true, version: s.version });
}
