import { NextResponse } from "next/server";
import { z } from "zod";
import { getSetting, setSetting } from "@/lib/server/settings";
import { publish } from "@/lib/server/bus";
import { setAiMode } from "@/lib/ai";

const KEYS = ["fillMode", "simFillMs", "mixedFillDelayMs", "aiMode", "checkinMs"] as const;
const Body = z.object({
  fillMode: z.enum(["simulated", "mixed", "live"]).optional(),
  simFillMs: z.number().int().min(0).max(120_000).optional(),
  mixedFillDelayMs: z.number().int().min(0).max(120_000).optional(),
  aiMode: z.enum(["cache", "live"]).optional(),
  /** how long a Companion waits for its person at each check-in (0 = no check-ins) */
  checkinMs: z.number().int().min(0).max(120_000).optional(),
});

export const dynamic = "force-dynamic";

export async function GET() {
  const out: Record<string, string> = {};
  for (const k of KEYS) out[k] = await getSetting(k, "");
  return NextResponse.json(out);
}

export async function POST(req: Request) {
  const p = Body.safeParse(await req.json().catch(() => ({})));
  if (!p.success) return NextResponse.json({ error: "bad body" }, { status: 400 });
  for (const [k, v] of Object.entries(p.data)) if (v !== undefined) await setSetting(k, String(v));
  if (p.data.aiMode) setAiMode(p.data.aiMode); // "cache" = run fully from cache (offline)
  publish("demo", { type: "settings" });
  return GET();
}
