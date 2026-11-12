import { NextResponse } from "next/server";
import { z } from "zod";
import { createFairProfile, FAIR_EVENT_ID } from "@/lib/server/after";
import { joinQueue } from "@/lib/server/queue";
import { VIEWER_COOKIE } from "@/lib/server/viewer";

const Body = z.object({
  firstName: z.string().trim().min(1).max(40),
  age: z.number().int().min(0).max(120),
  gender: z.enum(["woman", "man", "nonbinary"]),
  pronouns: z.string().max(30).default(""),
  sentence: z.string().trim().min(3).max(280),
  facts: z.array(z.object({ tag: z.string().max(40), text: z.string().max(120), ask: z.string().max(120), approved: z.boolean() })).max(3),
  consent: z.literal(true, { message: "Consent is required to join." }),
});

/** QR join at a fair: a typed profile (no photo), a consent box, then the queue. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "bad request" }, { status: 400 });
  try {
    const p = createFairProfile(parsed.data);
    await joinQueue({ userId: p.id, eventId: FAIR_EVENT_ID, sentence: parsed.data.sentence, consentBridges: true });
    const res = NextResponse.json({ ok: true, id: p.id });
    res.cookies.set(VIEWER_COOKIE, p.id, { path: "/", sameSite: "lax" });
    return res;
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
