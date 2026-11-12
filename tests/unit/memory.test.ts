import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_PARTY as D } from "@/fixtures";
import { runParty } from "@/lib/agents/orchestrator";
import { flag } from "@/lib/flags";
import { forgetMemory, memoryOf, remember, suggestions } from "@/lib/server/memory";
import { joinQueue } from "@/lib/server/queue";
import { profile, resetStore, store } from "@/lib/server/store";

const FIVE = ["dev", "ana", "kai", "zoe", "maya"];
async function locked() {
  resetStore();
  for (const id of FIVE) await joinQueue({ userId: id, eventId: D.entryEventId, sentence: D.sentences[id]!, consentBridges: true, startTalk: false });
  const pid = [...store().parties.keys()][0]!;
  await runParty(pid, { paceMs: 0 });
  return pid;
}

describe("your agent remembers, with your OK (F39)", () => {
  beforeEach(() => {
    process.env.PQ_PACE_MS = "0";
  });

  it("is on by default", () => expect(flag("AGENT_MEMORY")).toBe(true));

  it("a feeling suggests preferences from the plan, never about people; only the ticked ones are kept", async () => {
    const pid = await locked();
    expect(suggestions(pid, "maya", "loved").map((s) => s.tag)).toEqual(["outdoors", "food", "chill", "social", "music"]);
    expect(suggestions(pid, "maya", "loud")).toEqual([{ tag: "quiet", weight: 2, from: "Dolores Night Market" }]);
    expect(suggestions(pid, "maya", "meh")).toEqual([]);
    expect(remember(pid, "maya", "loved", ["outdoors", "food", "not-offered"])).toEqual([
      { tag: "outdoors", weight: 1, from: "Dolores Night Market" },
      { tag: "food", weight: 1, from: "Dolores Night Market" },
    ]);
    const all = JSON.stringify(memoryOf("maya"));
    for (const id of FIVE.filter((x) => x !== "maya")) expect(all).not.toContain(profile(id).firstName);
  });

  it("next time it's added to your preferences (never your rules), unless you leave it out; and it can be forgotten", async () => {
    const pid = await locked();
    remember(pid, "maya", "loud", ["quiet"]);
    const memory = store().memory.get("maya");
    resetStore();
    store().memory.set("maya", memory!); // the next night
    await joinQueue({ userId: "maya", eventId: D.entryEventId, sentence: D.sentences.maya!, consentBridges: true, startTalk: false });
    const b = store().briefs.get("brief-maya")!;
    expect(b.preferences.find((p) => p.tag === "quiet")).toMatchObject({ weight: 2, sourceText: "remembered from Dolores Night Market" });
    expect(b.hardRules.map((r) => r.kind).sort()).toEqual(["end_by", "max_price", "no_drink_minimum"]);
    await joinQueue({ userId: "maya", eventId: D.entryEventId, sentence: D.sentences.maya!, consentBridges: true, startTalk: false, useMemory: false });
    expect(store().briefs.get("brief-maya")!.preferences.some((p) => p.tag === "quiet")).toBe(false);
    forgetMemory("maya");
    expect(memoryOf("maya")).toEqual([]);
  });

  it("only from your own locked party", async () => {
    const pid = await locked();
    expect(() => remember(pid, "priya", "loved", ["food"])).toThrow("Only after your plan is set.");
    expect(suggestions("nope", "maya", "loved")).toEqual([]);
  });
});
