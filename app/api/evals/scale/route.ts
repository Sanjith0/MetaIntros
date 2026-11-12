import { NextResponse } from "next/server";
import { runScale } from "@/lib/evals/scale";
import { flag } from "@/lib/flags";

export const dynamic = "force-dynamic";

/** A whole fair in a sandbox: nothing live changes, no real model calls. */
export async function POST(req: Request) {
  if (!flag("SCALE_TEST")) return NextResponse.json({ error: "off" }, { status: 404 });
  const n = Number(new URL(req.url).searchParams.get("n") ?? 100);
  return NextResponse.json(await runScale(Number.isFinite(n) ? n : 100));
}
