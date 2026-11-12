import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { SignupInput } from "@/lib/signup";
import { AgeBand, Gender } from "@/lib/domain/enums";
import { createLiveUser, createSampleLiveUser } from "@/lib/server/signup";
import { SESSION_COOKIE } from "@/lib/server/session";
import { publish } from "@/lib/server/bus";

const SampleInput = z
  .object({ sample: z.literal(true), name: z.string().trim().min(2).max(40), ageBand: AgeBand, gender: Gender.nullable(), womenOnlyParty: z.boolean().default(false) })
  .refine((v) => !v.womenOnlyParty || v.gender === "woman", { path: ["womenOnlyParty"], message: "Women-only squads are available to women" });

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  let result;
  if (body?.sample) {
    const p = SampleInput.safeParse(body);
    if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message ?? "invalid" }, { status: 400 });
    result = await createSampleLiveUser(prisma, p.data);
  } else {
    const p = SignupInput.safeParse(body);
    if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message ?? "invalid", issues: p.error.issues }, { status: 400 });
    result = await createLiveUser(prisma, p.data);
  }
  publish("demo", { type: "signup", userId: result.userId });
  const res = NextResponse.json({ ok: true, userId: result.userId });
  res.cookies.set(SESSION_COOKIE, result.sessionId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7 });
  return res;
}

/** Sign out (back to the presenter's "Me"). */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
