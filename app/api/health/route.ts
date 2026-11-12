import { NextResponse } from "next/server";
import { checkDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = await checkDb();
  return NextResponse.json({ ok: db, db }, { status: db ? 200 : 503 });
}
