import { NextResponse } from "next/server";
import { z } from "zod";
import { joinQueue } from "@/lib/server/queue";
import { getCurrentUserId } from "@/lib/server/session";
import { prisma } from "@/lib/db";
import { isAdultBand } from "@/lib/server/signup";

const Body = z.object({
  mode: z.enum(["events", "hangout"]).default("events"),
  eventId: z.string().nullable(),
  targetSize: z.number().int(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  landmarkId: z.string().optional(),
  locationSource: z.enum(["gps", "manual", "seed"]).default("manual"),
  visibleToFriends: z.boolean().optional(),
  tonight: z.string().max(400).nullable().optional(),
});

export async function POST(req: Request) {
  const p = Body.safeParse(await req.json().catch(() => ({})));
  if (!p.success) return NextResponse.json({ ok: false, error: "bad_body" }, { status: 400 });
  const userId = await getCurrentUserId();
  // 18+ to queue (PRODUCT.md). The engine's age-band rules stay as the backstop.
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { ageBand: true } });
  if (!u || !isAdultBand(u.ageBand)) return NextResponse.json({ ok: false, error: "age" }, { status: 403 });
  const r = await joinQueue(userId, p.data);
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
