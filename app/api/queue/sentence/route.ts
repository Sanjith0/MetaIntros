import { NextResponse } from "next/server";
import { z } from "zod";
import { queueStatus, updateSentence } from "@/lib/server/queue";
import { currentViewerId } from "@/lib/server/viewer";

const Body = z.object({ sentence: z.string().trim().min(3).max(280), approvedLineIds: z.array(z.string()).optional() });

/** Change your own sentence while you wait; your place in line stays. */
export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Type one sentence about your night." }, { status: 400 });
  const viewer = await currentViewerId();
  try {
    await updateSentence(viewer, body.data.sentence, body.data.approvedLineIds);
    return NextResponse.json({ ok: true, status: queueStatus(viewer) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
