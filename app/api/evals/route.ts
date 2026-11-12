import { NextResponse } from "next/server";
import { runComparison, type Comparison } from "@/lib/evals/compare";

export const dynamic = "force-dynamic";

const g = globalThis as unknown as { __pqEvalCache?: Comparison };

/** The leak test four ways. Cached until someone asks for a fresh run. Runs in an isolated store. */
export async function GET(req: Request) {
  const fresh = new URL(req.url).searchParams.get("fresh") === "1";
  if (!g.__pqEvalCache || fresh) g.__pqEvalCache = await runComparison(25);
  return NextResponse.json(g.__pqEvalCache);
}
