import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_PARTY as D } from "@/fixtures";
import { runParty } from "@/lib/agents/orchestrator";
import { flag } from "@/lib/flags";
import { consentHistory } from "@/lib/server/consent";
import { forgetNight, setKeepNight } from "@/lib/server/forget";
import { forgetMemory, remember } from "@/lib/server/memory";
import { joinQueue } from "@/lib/server/queue";
import { revokeFact } from "@/lib/server/revoke";
import { resetStore, store } from "@/lib/server/store";

describe("consent history (F60)", () => {
  beforeEach(() => {
    process.env.PQ_PACE_MS = "0";
    resetStore();
  });

  it("is on by default", () => expect(flag("CONSENT_HISTORY")).toBe(true));

  it("every agreement and every take-back is kept for its owner, newest first, and only for them", async () => {
    for (const id of ["dev", "ana", "kai", "zoe", "maya"]) await joinQueue({ userId: id, eventId: D.entryEventId, sentence: D.sentences[id]!, consentBridges: id !== "kai", startTalk: false });
    const pid = [...store().parties.keys()][0]!;
    await runParty(pid, { paceMs: 0 });
    remember(pid, "maya", "loud", ["quiet"]);
    setKeepNight(pid, "maya", true);
    revokeFact("maya", "maya-f1");
    forgetMemory("maya");
    forgetNight(pid, "maya");
    const h = consentHistory("maya");
    expect(h.map((e) => [e.kind, e.text])).toEqual([
      ["withdrew", "Your private data from Dolores Night Market was deleted."],
      ["withdrew", "Made your agent forget what it remembered."],
      ["withdrew", "Stopped sharing “film photography”; everything built from it was rewritten."],
      ["gave", "Chose to keep your private data from Dolores Night Market after the night."],
      ["gave", "Let your agent remember: prefers quiet (from Dolores Night Market)."],
      ["gave", expect.stringMatching(/^Queued for Rooftop Sunset Session: your party may see how you're tied \(a friend in common or a small Group\); your agent may share \d+ lines you approved\.$/)],
    ]);
    expect(consentHistory("kai")[0]!.text).toContain("how you're tied stays hidden");
    expect(consentHistory("dev").some((e) => e.text.includes("film photography"))).toBe(false);
  });
});
