import { NextResponse } from "next/server";
import { z } from "zod";
import { report } from "@/lib/server/safety";
import { currentViewerId } from "@/lib/server/viewer";

const Body = z.object({
  subjectId: z.string(),
  reason: z.enum(["uncomfortable", "unsafe", "no-show", "spam", "other"]),
  note: z.string().max(500).optional(),
  alsoBlock: z.boolean().optional(),
});

/** Report someone from your party. They are not told. */
export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, ...report({ reporterId: await currentViewerId(), ...body.data }) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }
}
