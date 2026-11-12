import { NextResponse } from "next/server";
import { z } from "zod";
import { FLAG_NAMES, allFlags, flagDefault, setFlagOverride, type FlagName } from "@/lib/flags";

export const dynamic = "force-dynamic";

const Body = z.object({ name: z.string(), value: z.boolean().nullable() });

function list() {
  const now = allFlags();
  return FLAG_NAMES.map((name) => ({ name, on: now[name], default: flagDefault(name) }));
}

export function GET() {
  return NextResponse.json({ flags: list() });
}

/** Demo control: turn a layer on or off at runtime (null = back to its default). */
export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success || !(FLAG_NAMES as string[]).includes(body.data.name)) return NextResponse.json({ error: "unknown flag" }, { status: 400 });
  setFlagOverride(body.data.name as FlagName, body.data.value);
  return NextResponse.json({ flags: list() });
}
