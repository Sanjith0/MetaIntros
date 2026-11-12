import { NextResponse } from "next/server";
import { z } from "zod";
import { getBadges, markTabSeen, TABS } from "@/lib/server/badges";
import { getCurrentUserId } from "@/lib/server/session";

const Body = z.object({ tab: z.enum(TABS as [string, ...string[]]) });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "bad tab" }, { status: 400 });
  const userId = await getCurrentUserId();
  await markTabSeen(userId, parsed.data.tab as never);
  return NextResponse.json(await getBadges(userId));
}
