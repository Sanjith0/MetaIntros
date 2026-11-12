import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { seedDatabase } from "@/lib/seed/seed";
import { cancelAllSims } from "@/lib/server/queue";
import { publish } from "@/lib/server/bus";

export const dynamic = "force-dynamic";

/** One-click reset + reseed (demo control panel; also used by E2E tests for isolation). */
export async function POST() {
  cancelAllSims();
  // demo settings survive a reset (the presenter picks the mode once)
  const keep = await prisma.appSetting.findMany({ where: { key: { in: ["fillMode", "simFillMs", "mixedFillDelayMs", "aiMode"] } } });
  const r = await seedDatabase(prisma);
  for (const k of keep) await prisma.appSetting.upsert({ where: { key: k.key }, create: { key: k.key, value: k.value }, update: { value: k.value } });
  publish("demo", { type: "reset" });
  const res = NextResponse.json({ ok: true, ...r });
  res.cookies.delete("qu_session");
  return res;
}
