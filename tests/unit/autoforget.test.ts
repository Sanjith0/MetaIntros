import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEMO_PARTY as D } from "@/fixtures";
import { privatePhrases } from "@/lib/agents/audit";
import { runParty } from "@/lib/agents/orchestrator";
import { flag } from "@/lib/flags";
import { setDemoNow } from "@/lib/server/clock";
import { autoForgetDue, forgetAt, isForgotten, pacificLabel, scanStore, setKeepNight, wasAutoForgotten } from "@/lib/server/forget";
import { joinQueue } from "@/lib/server/queue";
import { resetStore, store } from "@/lib/server/store";

const FIVE = ["dev", "ana", "kai", "zoe", "maya"];
async function locked() {
  resetStore();
  for (const id of FIVE) await joinQueue({ userId: id, eventId: D.entryEventId, sentence: D.sentences[id]!, consentBridges: true, startTalk: false });
  const pid = [...store().parties.keys()][0]!;
  await runParty(pid, { paceMs: 0 });
  return pid;
}

describe("forget by default after the night (F43)", () => {
  beforeEach(() => {
    process.env.PQ_PACE_MS = "0";
  });
  afterEach(() => setDemoNow(null));

  it("is on by default", () => expect(flag("AUTO_FORGET")).toBe(true));

  it("nothing goes before the chat closes; after, every member's private data is deleted and the store holds none of their words", async () => {
    const pid = await locked();
    const at = forgetAt(pid)!;
    expect(pacificLabel(at)).toBe("Sun 10 AM"); // 12 hours after the market ends
    const words = FIVE.flatMap((id) => privatePhrases(pid, id));
    expect(autoForgetDue(Date.parse(at) - 60_000)).toBe(0);
    expect(scanStore(words).found.length).toBeGreaterThan(0);
    expect(autoForgetDue(Date.parse(at) + 60_000)).toBe(5);
    for (const id of FIVE) expect(isForgotten(pid, id) && wasAutoForgotten(pid, id)).toBe(true);
    // Words two members share may still be another's own; every phrase unique to its owner is gone.
    expect(scanStore(words).found).toEqual([]);
    expect(autoForgetDue(Date.parse(at) + 120_000)).toBe(0); // once only
  });

  it("someone who chose to keep it keeps it", async () => {
    const pid = await locked();
    setKeepNight(pid, "maya", true);
    expect(autoForgetDue(Date.parse(forgetAt(pid)!) + 60_000)).toBe(4);
    expect(isForgotten(pid, "maya")).toBe(false);
    expect(store().briefs.get("brief-maya")!.sentence).toBe(D.sentences.maya);
    expect(() => setKeepNight(pid, "priya", true)).toThrow("Not your party.");
  });
});
