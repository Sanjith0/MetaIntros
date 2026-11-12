import { NextResponse } from "next/server";
import { z } from "zod";
import { DEMO_PARTY } from "@/fixtures";
import { joinQueue } from "@/lib/server/queue";
import { resetStore } from "@/lib/server/store";

export const dynamic = "force-dynamic";

const Body = z.object({
  /** "four": queue Dev, Ana, Kai and Zoe so Maya's join forms the party. "all": queue all five. */
  mode: z.enum(["four", "all"]).default("four"),
  reset: z.boolean().default(true),
});

/** Demo driver for the stage and the demo path. Seeded, fictional people only. */
export async function POST(req: Request) {
  const body = Body.parse(await req.json().catch(() => ({})));
  if (body.reset) resetStore();
  const ids = body.mode === "all" ? ["dev", "ana", "kai", "zoe", "maya"] : ["dev", "ana", "kai", "zoe"];
  let partyId: string | null = null;
  for (const id of ids) {
    const r = await joinQueue({ userId: id, eventId: DEMO_PARTY.entryEventId, sentence: DEMO_PARTY.sentences[id]!, consentBridges: true });
    partyId = r.partyId ?? partyId;
  }
  return NextResponse.json({ ok: true, queued: ids, partyId });
}
