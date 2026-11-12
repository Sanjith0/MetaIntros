import { prisma } from "@/lib/db";

/** Demo clock: real time + an offset that "Fast-forward time" bumps. */
export async function getClockOffsetMs(): Promise<number> {
  const row = await prisma.appSetting.findUnique({ where: { key: "clockOffsetMs" } });
  return row ? Number(row.value) || 0 : 0;
}

export async function now(): Promise<Date> {
  return new Date(Date.now() + (await getClockOffsetMs()));
}

export async function setClockOffsetMs(ms: number) {
  await prisma.appSetting.upsert({
    where: { key: "clockOffsetMs" },
    create: { key: "clockOffsetMs", value: String(ms) },
    update: { value: String(ms) },
  });
}
