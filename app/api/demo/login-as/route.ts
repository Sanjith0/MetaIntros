import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/server/session";

/** Demo-only: view the app as another seeded member (e.g. show a squadmate's phone). */
export async function POST(req: Request) {
  const p = z.object({ userId: z.string() }).safeParse(await req.json().catch(() => ({})));
  if (!p.success) return NextResponse.json({ error: "bad body" }, { status: 400 });
  const u = await prisma.user.findUnique({ where: { id: p.data.userId } });
  if (!u) return NextResponse.json({ error: "no user" }, { status: 404 });
  const s = await prisma.deviceSession.create({ data: { userId: u.id } });
  const res = NextResponse.json({ ok: true, userId: u.id });
  res.cookies.set(SESSION_COOKIE, s.id, { httpOnly: true, sameSite: "lax", path: "/" });
  return res;
}
