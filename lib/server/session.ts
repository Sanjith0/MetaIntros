import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { loadClock } from "./clock";

export const SESSION_COOKIE = "qu_session";

/**
 * Current user: the DeviceSession cookie (live sign-ups) or, when absent, the seeded
 * "Me" persona — the presenter's laptop is always logged in as Me.
 */
export async function getCurrentUserId(): Promise<string> {
  await loadClock(); // every request knows the global clock before it writes any timestamp
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const s = await prisma.deviceSession.findUnique({ where: { id: token } });
    if (s) return s.userId;
  }
  const me = await prisma.user.findFirst({ where: { isMe: true }, select: { id: true } });
  if (!me) throw new Error("Database not seeded: no 'Me' user");
  return me.id;
}

export async function getCurrentUser() {
  const id = await getCurrentUserId();
  return prisma.user.findUniqueOrThrow({ where: { id } });
}
