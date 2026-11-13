import { NextResponse } from "next/server";
import { fastForward } from "@/lib/server/expiry";

/** Demo: end the next event to finish, for everyone (see fastForward). */
export async function POST() {
  const r = await fastForward();
  return NextResponse.json(r, { status: r.ok ? 200 : 404 });
}
