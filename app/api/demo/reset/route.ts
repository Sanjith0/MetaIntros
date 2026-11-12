import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { seedDatabase } from "@/lib/seed/seed";

export const dynamic = "force-dynamic";

/** One-click reset + reseed (demo control panel; also used by E2E tests for isolation). */
export async function POST() {
  const r = await seedDatabase(prisma);
  const res = NextResponse.json({ ok: true, ...r });
  res.cookies.delete("qu_session");
  return res;
}
