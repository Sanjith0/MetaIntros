import { NextResponse } from "next/server";
import { z } from "zod";
import { fairStats, simulateArrivals, simulateGuests } from "@/lib/server/fair";

export const dynamic = "force-dynamic";

const Body = z.discriminatedUnion("kind", [z.object({ kind: z.literal("guests"), n: z.number().int().min(1).max(30) }), z.object({ kind: z.literal("arrivals") })]);

/** Demo only: fictional guests join, or everyone in a locked fair party arrives. */
export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  if (body.data.kind === "guests") await simulateGuests(body.data.n);
  else simulateArrivals();
  return NextResponse.json(fairStats());
}
