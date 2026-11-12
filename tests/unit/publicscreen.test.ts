import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEMO_PARTY as D } from "@/fixtures";
import { privatePhrases } from "@/lib/agents/audit";
import { runParty } from "@/lib/agents/orchestrator";
import { flag } from "@/lib/flags";
import { joinQueue } from "@/lib/server/queue";
import { profile, resetStore, store } from "@/lib/server/store";
import { captionAt, roomRows } from "@/lib/stage/captions";
import { resetModelSettings, setModelSettings } from "@/model/settings";

const FIVE = ["dev", "ana", "kai", "zoe", "maya"];
async function run() {
  resetStore();
  for (const id of FIVE) await joinQueue({ userId: id, eventId: D.entryEventId, sentence: D.sentences[id]!, consentBridges: true, startTalk: false });
  const pid = [...store().parties.keys()][0]!;
  await runParty(pid, { paceMs: 0 });
  return { pid, traces: store().traces.filter((t) => t.partyId === pid) };
}

describe("public screen mode (F41)", () => {
  beforeEach(() => {
    process.env.PQ_PACE_MS = "0";
    resetModelSettings();
  });
  afterEach(() => resetModelSettings());

  it("is on by default", () => expect(flag("PUBLIC_SCREEN")).toBe(true));

  for (const rogue of [false, true]) {
    it(`what the room sees holds no names, nobody's private words and no agent's lines${rogue ? " (rogue model)" : ""}`, async () => {
      if (rogue) setModelSettings({ rogue: true });
      const { pid, traces } = await run();
      const names = FIVE.map((id) => profile(id).firstName);
      const secrets = FIVE.flatMap((id) => privatePhrases(pid, id));
      const approved = FIVE.flatMap((id) => store().briefs.get(`brief-${id}`)!.shareable.filter((l) => l.approved).map((l) => l.text));
      const rows = roomRows(traces);
      expect(rows.length).toBeGreaterThan(5);
      const texts = [...rows.map((r) => `${r.title} ${r.body}`), ...traces.map((_, i) => captionAt(traces, i + 1, (id) => profile(id).firstName, undefined, true)?.text ?? "")];
      for (const t of texts) {
        for (const n of names) expect(t, t).not.toContain(n);
        for (const w of secrets) expect(t).not.toContain(w);
        for (const a of approved) expect(t).not.toContain(a);
      }
      expect(rows.map((r) => r.body)).toEqual(expect.arrayContaining(["Rooftop Sunset Session · unavailable", "5 of 5 signed Dolores Night Market."]));
      expect(captionAt(traces, traces.length, (id) => id, undefined, true)!.text).toBe("Code locked Dolores Night Market. MATCH FOUND on all five phones.");
    });
  }
});
