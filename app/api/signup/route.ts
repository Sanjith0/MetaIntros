import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { SignupInput } from "@/lib/signup";
import { AgeBand, Gender } from "@/lib/domain/enums";
import { createLiveUser, createSampleLiveUser, deleteLiveUser, isAdultBand, sweepExpiredSignups } from "@/lib/server/signup";
import { getCurrentUserId, SESSION_COOKIE } from "@/lib/server/session";
import { publish } from "@/lib/server/bus";

const SampleInput = z
  .object({ sample: z.literal(true), name: z.string().trim().min(2).max(40), ageBand: AgeBand, gender: Gender.nullable(), womenOnlyParty: z.boolean().default(false) })
  .refine((v) => !v.womenOnlyParty || v.gender === "woman", { path: ["womenOnlyParty"], message: "Women-only squads are available to women" });

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  await sweepExpiredSignups(prisma);
  if (body?.ageBand && !isAdultBand(body.ageBand)) return NextResponse.json({ error: "Link is for people 18 and over." }, { status: 400 });
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

/**
 * Sign out (back to the presenter's "Me"). With ?forget=1, a live sign-up is deleted right away
 * ("Delete my demo data" on Profile), as /join promises.
 */
export async function DELETE(req: Request) {
  let deleted = false;
  if (new URL(req.url).searchParams.get("forget") === "1") {
    const id = await getCurrentUserId();
    deleted = await deleteLiveUser(prisma, id);
    if (deleted) publish("demo", { type: "kick" });
  }
  const res = NextResponse.json({ ok: true, deleted });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
