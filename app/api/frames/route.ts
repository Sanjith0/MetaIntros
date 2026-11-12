import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { spotFromFrame } from "@/lib/server/door";

/** POST a Frame; returns Spotted from the stub behind matchFrame(frame, gallery). */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  try {
    const spotted = await spotFromFrame(body);
    return NextResponse.json(spotted);
  } catch (e) {
    const msg = e instanceof ZodError ? "invalid frame" : (e as Error).message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
