import { prisma } from "@/lib/db";
import type { FillMode } from "@/lib/match/engine";

export async function getSetting(key: string, fallback: string): Promise<string> {
  const r = await prisma.appSetting.findUnique({ where: { key } });
  return r?.value ?? fallback;
}

export async function setSetting(key: string, value: string) {
  await prisma.appSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
}

export async function getFillMode(): Promise<FillMode> {
  const v = await getSetting("fillMode", "simulated");
  return v === "live" || v === "mixed" ? v : "simulated";
}
