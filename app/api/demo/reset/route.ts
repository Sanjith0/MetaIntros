import { NextResponse } from "next/server";
import { resetStore } from "@/lib/server/store";
import { resetModelSettings } from "@/model/settings";
import { setDemoNow } from "@/lib/server/clock";

export const dynamic = "force-dynamic";

/** A full reset: state and model settings. ?keepSettings=1 keeps the settings. */
export function POST(req: Request) {
  const s = resetStore();
  if (new URL(req.url).searchParams.get("keepSettings") !== "1") {
    resetModelSettings();
    setDemoNow(null);
  }
  return NextResponse.json({ ok: true, version: s.version });
}
