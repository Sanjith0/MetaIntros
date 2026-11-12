/* Record one full demo party: every model call's output and latency, saved to
 * fixtures/recordings/demo-party.json. Replays are labelled "recorded" on screen,
 * along with what produced them. Usage: npm run record */
import fs from "node:fs";
import path from "node:path";

const envFile = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
process.env.PQ_PACE_MS = "0";

async function main() {
  const { DEMO_PARTY: D } = await import("../fixtures");
  const { joinQueue } = await import("../lib/server/queue");
  const { runParty } = await import("../lib/agents/orchestrator");
  const { store } = await import("../lib/server/store");
  const { setModelSettings, resetModelSettings } = await import("../model/settings");
  const { takeRecorded, saveRecording, DEFAULT_RECORDING } = await import("../model/recording");

  resetModelSettings();
  setModelSettings({ record: true });
  takeRecorded();
  for (const id of ["dev", "ana", "kai", "zoe", "maya"]) {
    await joinQueue({ userId: id, eventId: D.entryEventId, sentence: D.sentences[id]!, consentBridges: true, startTalk: false });
  }
  const pid = [...store().parties.keys()][0]!;
  await runParty(pid, { paceMs: 0 });
  const calls = takeRecorded();
  const sources = new Set(Object.values(calls).map((c) => c.source));
  const origin = sources.size === 1 && sources.has("model") ? "model" : sources.size === 1 && sources.has("mock") ? "mock" : "mixed";
  saveRecording({ name: DEFAULT_RECORDING, recordedAt: new Date().toISOString(), origin, calls });
  console.log(`recorded ${Object.keys(calls).length} calls from the ${origin} model -> fixtures/recordings/${DEFAULT_RECORDING}.json; plan ${store().parties.get(pid)!.planId}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
