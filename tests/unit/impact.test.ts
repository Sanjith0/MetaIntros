import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_PARTY as D } from "@/fixtures";
import { runParty } from "@/lib/agents/orchestrator";
import { flag } from "@/lib/flags";
import { arrive } from "@/lib/server/door";
import { eventImpact } from "@/lib/server/pulse";
import { joinQueue } from "@/lib/server/queue";
import { profile, resetStore, store } from "@/lib/server/store";

describe("what Party Queue brings to an event (F55)", () => {
  beforeEach(() => {
    process.env.PQ_PACE_MS = "0";
    resetStore();
  });

  it("is on by default", () => expect(flag("EVENT_IMPACT")).toBe(true));

  it("the market's page: one party of five coming, then how many are already here; counts only", async () => {
    expect(eventImpact("evt-night-market")).toBeNull();
    for (const id of ["dev", "ana", "kai", "zoe", "maya"]) await joinQueue({ userId: id, eventId: D.entryEventId, sentence: D.sentences[id]!, consentBridges: true, startTalk: false });
    const pid = [...store().parties.keys()][0]!;
    expect(eventImpact("evt-night-market")).toBeNull(); // not before the lock
    await runParty(pid, { paceMs: 0 });
    expect(eventImpact("evt-night-market")!.text).toBe("Party Queue: 1 party of five is coming tonight.");
    expect(eventImpact("evt-rooftop")).toBeNull(); // where they queued isn't where they're going
    arrive(pid, "maya");
    arrive(pid, "dev");
    const r = eventImpact("evt-night-market")!;
    expect(r).toEqual({ text: "Party Queue: 1 party of five is coming tonight · 2 already here.", parties: 1, people: 5, here: 2 });
    for (const id of ["maya", "dev"]) expect(r.text).not.toContain(profile(id).firstName);
  });
});
