import { NextResponse } from "next/server";
import { z } from "zod";
import { parseSentence, proposeLines } from "@/lib/agents/brief";
import { profile } from "@/lib/server/store";
import { currentViewerId } from "@/lib/server/viewer";

const Body = z.object({ sentence: z.string().max(280) });

/** Preview for the owner only: their own private rules, preferences and
 *  the lines they may approve. Nothing is stored or shared. */
export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const viewer = await currentViewerId();
  const parsed = parseSentence(viewer, body.data.sentence);
  const { lines } = proposeLines(viewer, parsed.preferences, profile(viewer).facts);
  return NextResponse.json({ hardRules: parsed.hardRules, preferences: parsed.preferences, lines });
}
