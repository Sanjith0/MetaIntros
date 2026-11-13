import { NextResponse } from "next/server";
import { z } from "zod";
import { QueueVisibility } from "@/lib/domain/enums";
import { setQueueVisibility } from "@/lib/server/friendQueues";
import { getCurrentUserId } from "@/lib/server/session";

const Body = z.object({ visibility: QueueVisibility });

/** "Let friends see when I'm queuing" (Profile). Also applies to the queue you're in right now. */
export async function POST(req: Request) {
  const p = Body.safeParse(await req.json().catch(() => ({})));
  if (!p.success) return NextResponse.json({ ok: false, error: "bad_body" }, { status: 400 });
  await setQueueVisibility(await getCurrentUserId(), p.data.visibility);
  return NextResponse.json({ ok: true });
}
