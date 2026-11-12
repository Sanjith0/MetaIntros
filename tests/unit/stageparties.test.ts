import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_PARTY as D } from "@/fixtures";
import { runParty } from "@/lib/agents/orchestrator";
import { flag } from "@/lib/flags";
import { submitPicks } from "@/lib/server/after";
import { joinQueue } from "@/lib/server/queue";
import { resetStore, store } from "@/lib/server/store";
import { stageParties, stageView } from "@/lib/server/views";

describe("stage party switcher (F28)", () => {
  beforeEach(() => {
    process.env.PQ_PACE_MS = "0";
  });

  it("is on by default", () => expect(flag("STAGE_PARTIES")).toBe(true));

  it("lists every party newest first with its night, place and status; any party can be loaded by id", async () => {
    resetStore();
    expect(stageParties()).toEqual([]);
    for (const id of ["dev", "ana", "kai", "zoe", "maya"]) await joinQueue({ userId: id, eventId: D.entryEventId, sentence: D.sentences[id]!, consentBridges: true, startTalk: false });
    const sat = [...store().parties.keys()][0]!;
    await runParty(sat, { paceMs: 0 });
    submitPicks(sat, "dev", ["maya", "ana"]);
    submitPicks(sat, "ana", ["maya", "dev"]);
    submitPicks(sat, "maya", ["dev", "ana"]);
    for (const [id, groupOf] of [["dev", sat], ["ana", sat], ["priya", null], ["theo", null], ["maya", sat]] as const)
      await joinQueue({ userId: id, eventId: D.standingEventId, sentence: "anything social", consentBridges: true, groupOf, startTalk: false });
    const sun = [...store().parties.keys()][1]!;
    expect(stageParties()).toEqual([
      { id: sun, label: "Sun · Ferry Building · forming", status: "forming" },
      { id: sat, label: "Sat · Dolores Park · locked", status: "locked" },
    ]);
    // The default view is the newest; an id loads that party, with the same list.
    expect(stageView().partyId).toBe(sun);
    const v = stageView(sat);
    expect(v.partyId).toBe(sat);
    expect(v.plans.map((p) => p.title)).toContain("Dolores Night Market");
    expect(v.parties).toHaveLength(2);
  });

  it("a party with no plan says so", async () => {
    resetStore();
    for (const id of ["dev", "ana", "kai", "zoe", "maya"]) await joinQueue({ userId: id, eventId: D.entryEventId, sentence: D.clashSentences[id] ?? D.sentences[id]!, consentBridges: true, startTalk: false });
    await runParty([...store().parties.keys()][0]!, { paceMs: 0 });
    expect(stageParties()[0]!.label).toBe("Sat · Dolores Park · no match");
  });
});
