import { NextResponse } from "next/server";
import { DEMO_PARTY } from "@/fixtures";
import { runParty } from "@/lib/agents/orchestrator";
import { flag } from "@/lib/flags";
import { submitPicks } from "@/lib/server/after";
import { joinQueue } from "@/lib/server/queue";
import { resetStore, store } from "@/lib/server/store";

export const dynamic = "force-dynamic";

/** Demo driver for F26. Seeded, fictional people only. Resets, locks the demo party,
 *  makes Maya, Dev and Ana a standing party, and queues Dev and Ana (with it) and two
 *  new people for Sunday. Maya joins from her phone. */
export async function POST() {
  if (!flag("STANDING_QUEUE")) return NextResponse.json({ error: "off" }, { status: 404 });
  resetStore();
  for (const id of ["dev", "ana", "kai", "zoe", "maya"]) await joinQueue({ userId: id, eventId: DEMO_PARTY.entryEventId, sentence: DEMO_PARTY.sentences[id]!, consentBridges: true, startTalk: false });
  const partyId = [...store().parties.keys()][0]!;
  await runParty(partyId, { paceMs: 0 });
  submitPicks(partyId, "dev", ["maya", "ana"]);
  submitPicks(partyId, "ana", ["maya", "dev"]);
  submitPicks(partyId, "maya", ["dev", "ana"]);
  const sunday = DEMO_PARTY.standingEventId;
  await joinQueue({ userId: "dev", eventId: sunday, sentence: "trivia sounds fun, I'm fine spending up to 40", consentBridges: true, groupOf: partyId, startTalk: false });
  await joinQueue({ userId: "ana", eventId: sunday, sentence: "low-key, home by midnight", consentBridges: true, groupOf: partyId, startTalk: false });
  await joinQueue({ userId: "priya", eventId: sunday, sentence: "anything social, out by eleven", consentBridges: true, startTalk: false });
  await joinQueue({ userId: "theo", eventId: sunday, sentence: "games or a quiz night", consentBridges: true, startTalk: false });
  return NextResponse.json({ ok: true, partyId, eventId: sunday });
}
