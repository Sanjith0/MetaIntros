import { NextResponse } from "next/server";
import { z } from "zod";
import { loadRecording } from "@/model/recording";
import { modelSettings, resetModelSettings, setModelSettings } from "@/model/settings";

export const dynamic = "force-dynamic";

const Patch = z
  .object({
    simulateLatency: z.boolean(),
    timeoutAgent: z.string().nullable(),
    agentTimeoutMs: z.number().int().min(50).max(60_000),
    source: z.enum(["live", "recorded"]),
    latencyScale: z.number().min(0.01).max(2),
    paceMs: z.number().int().min(0).max(5000).nullable(),
    rogue: z.boolean(),
  })
  .partial();

function body() {
  const rec = loadRecording();
  return { settings: modelSettings(), recording: rec ? { name: rec.name, origin: rec.origin, recordedAt: rec.recordedAt, calls: Object.keys(rec.calls).length } : null };
}

export function GET() {
  return NextResponse.json(body());
}

/** Change how model calls behave for the demo (latency, a forced timeout, recorded replay). */
export async function POST(req: Request) {
  const patch = Patch.safeParse(await req.json().catch(() => null));
  if (!patch.success) return NextResponse.json({ error: "bad settings" }, { status: 400 });
  setModelSettings(patch.data);
  return NextResponse.json(body());
}

export function DELETE() {
  resetModelSettings();
  return NextResponse.json(body());
}
