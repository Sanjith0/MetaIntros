import { NextResponse } from "next/server";
import { aiStatus } from "@/lib/ai";

export const dynamic = "force-dynamic";

/** Truthful AI badge state (live / replay / degraded / offline / mock) from real call results. */
export async function GET() {
  return NextResponse.json(aiStatus());
}
