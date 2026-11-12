import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_PARTY as D } from "@/fixtures";
import { runParty } from "@/lib/agents/orchestrator";
import { flag } from "@/lib/flags";
import { joinQueue } from "@/lib/server/queue";
import { secretView } from "@/lib/server/secret";
import { postMessage } from "@/lib/server/social";
import { resetStore, store } from "@/lib/server/store";

async function locked() {
  resetStore();
  for (const id of ["dev", "ana", "kai", "zoe", "maya"]) {
    await joinQueue({ userId: id, eventId: D.entryEventId, sentence: D.sentences[id]!, consentBridges: true, startTalk: false });
  }
  const pid = [...store().parties.keys()][0]!;
  await runParty(pid, { paceMs: 0 });
  return pid;
}

describe("Maya's secret (F2)", () => {
  beforeEach(() => {
    process.env.PQ_PACE_MS = "0";
  });

  it("is on by default", () => expect(flag("SECRET_PANEL")).toBe(true));

  it("her phone shows her three rules in her own words and what her agent turned down", async () => {
    const v = secretView(await locked(), "maya")!;
    expect(v.rules.map((r) => r.label)).toEqual(["Done by 11 PM", "$20 or less", "No drink minimum"]);
    expect(v.rules.map((r) => r.yourWords)).toEqual(["out by eleven", "under twenty bucks", "nowhere I have to drink"]);
    expect(v.turnedDown.map((t) => t.title).sort()).toEqual(["Chef's Counter Supper", "Late Synth Showcase", "Rooftop Sunset Session"]);
  });

  it("what the party knows stays empty, from a scan of all four other phones", async () => {
    const v = secretView(await locked(), "maya")!;
    expect(v.partyKnows).toEqual([]);
    expect(v.checkedMembers).toBe(4);
    expect(v.checkedItems).toBeGreaterThan(40);
    // They saw only the marks, with no name and no reason.
    expect(v.partySaw).toEqual(expect.arrayContaining(["Rooftop Sunset Session · unavailable"]));
    for (const t of v.partySaw) expect(t).toMatch(/^[^·]+ · unavailable$/);
  });

  it("the column is a real check: a planted leak shows up for every member who can see it", async () => {
    const pid = await locked();
    const chatId = store().parties.get(pid)!.chatId!;
    postMessage(chatId, "dev", "heard someone said nowhere I have to drink lol");
    const v = secretView(pid, "maya")!;
    expect(v.partyKnows.map((k) => k.memberId).sort()).toEqual(["ana", "dev", "kai", "zoe"]);
    expect(v.partyKnows.every((k) => k.text === "nowhere I have to drink")).toBe(true);
  });

  it("each person sees only their own secret", async () => {
    const pid = await locked();
    const dev = secretView(pid, "dev")!;
    expect(dev.rules.map((r) => r.label)).toEqual(["$40 or less"]);
    expect(JSON.stringify(dev)).not.toContain("nowhere I have to drink");
    expect(secretView(pid, "priya")).toBeNull();
  });
});
