import { NextResponse } from "next/server";
import { modelConfig } from "@/model/client";
import { store } from "@/lib/server/store";

export const dynamic = "force-dynamic";

export function GET() {
  const cfg = modelConfig();
  return NextResponse.json({ ok: true, mockModel: cfg.mock, storeVersion: store().version });
}
