import { NextResponse } from "next/server";
import { setClockOffsetMs } from "@/lib/server/clock";
import { publish } from "@/lib/server/bus";

export const dynamic = "force-dynamic";

/** Demo: put the clock back to real time after a fast-forward (archived chats stay archived). */
export async function POST() {
  await setClockOffsetMs(0);
  publish("demo", { type: "fast-forward" }); // same refresh path as moving the clock forward
  return NextResponse.json({ ok: true });
}
