import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEMO_PARTY as D } from "@/fixtures";
import { privatePhrases } from "@/lib/agents/audit";
import { runParty } from "@/lib/agents/orchestrator";
import { flag } from "@/lib/flags";
import { joinQueue } from "@/lib/server/queue";
import { profile, resetStore, store } from "@/lib/server/store";
import { publicStageView, stageView } from "@/lib/server/views";
import { boardAt } from "@/lib/stage/board";
import { resetModelSettings, setModelSettings } from "@/model/settings";

const FIVE = ["dev", "ana", "kai", "zoe", "maya"];
async function run() {
  resetStore();
  for (const id of FIVE) await joinQueue({ userId: id, eventId: D.entryEventId, sentence: D.sentences[id]!, consentBridges: true, startTalk: false });
  const pid = [...store().parties.keys()][0]!;
  await runParty(pid, { paceMs: 0 });
  return pid;
}

describe("follow along: the room's view, enforced on the server (F46)", () => {
  beforeEach(() => {
    process.env.PQ_PACE_MS = "0";
    resetModelSettings();
  });
  afterEach(() => resetModelSettings());

  it("is on by default", () => expect(flag("FOLLOW_ALONG")).toBe(true));

  for (const rogue of [false, true]) {
    it(`the data sent to the room holds no names, no private words, no lines${rogue ? " (rogue model)" : ""}; the board still adds up`, async () => {
      if (rogue) setModelSettings({ rogue: true });
      const pid = await run();
      const full = stageView(pid);
      const room = publicStageView(pid);
      const json = JSON.stringify(room);
      const words = [
        ...FIVE.flatMap((id) => [profile(id).firstName, profile(id).name, id]),
        ...FIVE.flatMap((id) => privatePhrases(pid, id)),
        ...FIVE.flatMap((id) => store().briefs.get(`brief-${id}`)!.shareable.filter((l) => l.approved).map((l) => l.text)),
        "I'm in",
        "Happy to go with the group",
      ];
      for (const w of words) expect(json, w).not.toContain(`"${w}`.slice(1));
      expect(room.members.map((m) => m.name)).toEqual(["Seat 1", "Seat 2", "Seat 3", "Seat 4", "Seat 5"]);
      expect(room.traces.length).toBeLessThan(full.traces.length);
      // Same board: the plan, what's unavailable, and five signatures.
      const a = boardAt(full.traces, full.traces.length);
      const b = boardAt(room.traces, room.traces.length);
      expect(b.locked).toBe(a.locked);
      expect([...b.unavailable].sort()).toEqual([...a.unavailable].sort());
      expect(Object.values(b.signatures).filter((x) => x === "signed" || x === "conceded")).toHaveLength(5);
    });
  }
});
