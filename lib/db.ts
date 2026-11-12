import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; prismaPragmas?: Promise<void> };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * SQLite tuning for a single demo server with many concurrent readers (SSE, polling) and
 * occasional big write transactions (reset/reseed): WAL lets reads proceed during writes,
 * busy_timeout makes writers wait instead of failing.
 */
globalForPrisma.prismaPragmas ??= (async () => {
  try {
    await prisma.$queryRawUnsafe("PRAGMA journal_mode = WAL;");
    await prisma.$queryRawUnsafe("PRAGMA busy_timeout = 8000;");
    await prisma.$queryRawUnsafe("PRAGMA synchronous = NORMAL;");
  } catch {
    /* non-fatal */
  }
})();

export async function checkDb(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
