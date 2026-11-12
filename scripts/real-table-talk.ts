/* One real table talk against the Meta Model API, timed.
 * Runs only when META_API_KEY is set (environment or .env.local).
 * Usage: npm run talk:real */
import fs from "node:fs";
import path from "node:path";

const envFile = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

async function main() {
  if (!process.env.META_API_KEY) {
    console.log("real-table-talk: SKIPPED (no META_API_KEY in the environment or .env.local)");
    return;
  }
  process.env.MOCK_MODEL = "0";
  process.env.PQ_PACE_MS = "0";
  const { DEMO_PARTY: D } = await import("../fixtures");
  const { joinQueue } = await import("../lib/server/queue");
  const { runTableTalk } = await import("../lib/agents/table");
  const { store } = await import("../lib/server/store");
  const { realCallsUsed } = await import("../model/client");

  const before = realCallsUsed();
  for (const id of ["dev", "ana", "kai", "zoe", "maya"]) {
    await joinQueue({ userId: id, eventId: D.entryEventId, sentence: D.sentences[id]!, consentBridges: true, startTalk: false });
  }
  const partyId = [...store().parties.keys()][0]!;
  const t0 = Date.now();
  const result = await runTableTalk(partyId, { paceMs: 0 });
  const ms = Date.now() - t0;
  const sources = store()
    .traces.filter((t) => / · (model|mock|fallback) /.test(t.title))
    .map((t) => t.title.match(/ · (model|mock|fallback) /)![1]);
  console.log(`real-table-talk: ${ms} ms wall-clock, plan ${result?.planId ?? "none"} (${result?.lockedBy ?? "-"}), rounds ${result?.rounds ?? "-"}`);
  console.log(`agent turns by source: ${JSON.stringify(sources.reduce<Record<string, number>>((a, s) => ((a[s!] = (a[s!] ?? 0) + 1), a), {}))}`);
  console.log(`real model calls used: ${realCallsUsed() - before} this run, ${realCallsUsed()} tonight (cap 300)`);
}

main().catch((e) => {
  console.error("real-table-talk: FAILED", e instanceof Error ? e.message : e);
  process.exit(1);
});
