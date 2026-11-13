import { NextResponse } from "next/server";
import { z } from "zod";
import { createGroup } from "@/lib/server/queueGroups";
import { getCurrentUserId } from "@/lib/server/session";

export const dynamic = "force-dynamic";

const Body = z.object({
  mode: z.enum(["events", "hangout"]).default("events"),
  eventId: z.string().nullable(),
  targetSize: z.number().int(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  landmarkId: z.string().optional(),
  locationSource: z.enum(["gps", "manual", "seed"]).default("manual"),
  friendIds: z.array(z.string()).min(1).max(7),
});

/** Queue with friends: create the group and invite the friends picked on the queue sheet. */
export async function POST(req: Request) {
  const p = Body.safeParse(await req.json().catch(() => ({})));
  if (!p.success) return NextResponse.json({ ok: false, error: "bad_body" }, { status: 400 });
  const { friendIds, ...input } = p.data;
  const r = await createGroup(await getCurrentUserId(), input, friendIds);
  return NextResponse.json(r, { status: r.ok ? 200 : r.error === "age" ? 403 : 400 });
}
