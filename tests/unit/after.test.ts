import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_PARTY as D } from "@/fixtures";
import { runParty } from "@/lib/agents/orchestrator";
import { createFairProfile, FAIR_EVENT_ID, runItBackView, submitPicks } from "@/lib/server/after";
import { visibleTo } from "@/lib/server/bus";
import { joinQueue } from "@/lib/server/queue";
import { resetStore, store } from "@/lib/server/store";

async function lockedDemoParty() {
  resetStore();
  for (const id of ["dev", "ana", "kai", "zoe", "maya"]) {
    await joinQueue({ userId: id, eventId: D.entryEventId, sentence: D.sentences[id]!, consentBridges: true, startTalk: false });
  }
  const pid = [...store().parties.keys()][0]!;
  await runParty(pid, { paceMs: 0 });
  return pid;
}

describe("run it back", () => {
  beforeEach(() => {
    process.env.PQ_PACE_MS = "0";
  });

  it("shows only mutual picks, only to the two people in them", async () => {
    const pid = await lockedDemoParty();
    submitPicks(pid, "maya", ["dev", "zoe"]);
    submitPicks(pid, "zoe", ["kai"]);
    const fresh = submitPicks(pid, "dev", ["maya"]);
    expect(fresh).toHaveLength(1);
    expect(runItBackView(pid, "maya")!.mutual).toEqual(["dev"]);
    expect(runItBackView(pid, "dev")!.mutual).toEqual(["maya"]);
    // Zoe picked Kai, Maya picked Zoe: neither is mutual, and Zoe learns nothing.
    expect(runItBackView(pid, "zoe")!.mutual).toEqual([]);
    expect(runItBackView(pid, "kai")!.mutual).toEqual([]);
    // The event goes to Maya and Dev only, and carries no picks.
    const ev = store().events_log.filter((e) => e.type === "runitback.mutual");
    expect(ev).toHaveLength(1);
    for (const who of ["ana", "kai", "zoe"]) expect(visibleTo(ev[0]!, { userId: who })).toBe(false);
    for (const who of ["ana", "kai", "zoe", "maya", "dev"]) {
      const seen = JSON.stringify(store().events_log.filter((e) => visibleTo(e, { userId: who })));
      expect(seen).not.toContain("pickedIds");
    }
  });

  it("a withdrawn pick removes the mutual pair", async () => {
    const pid = await lockedDemoParty();
    submitPicks(pid, "maya", ["dev"]);
    submitPicks(pid, "dev", ["maya"]);
    submitPicks(pid, "maya", []);
    expect(runItBackView(pid, "dev")!.mutual).toEqual([]);
  });

  it("you cannot pick yourself or someone outside the party", async () => {
    const pid = await lockedDemoParty();
    submitPicks(pid, "maya", ["maya", "priya", "dev"]);
    expect(runItBackView(pid, "maya")!.myPicks).toEqual(["dev"]);
  });
});

describe("fair QR join", () => {
  beforeEach(() => {
    resetStore();
  });

  const guest = (n: number, over = {}) => ({
    firstName: `Guest${n}`,
    age: 25 + n,
    gender: (n % 2 ? "woman" : "man") as "woman" | "man",
    pronouns: "",
    facts: [
      { tag: "board games", text: `Owns ${n + 10} board games`, ask: "What's your favourite?", approved: true },
      { tag: "secret", text: "Something I typed but did not approve", ask: "?", approved: false },
    ],
    consent: true,
    ...over,
  });

  it("needs the consent box and 18+", () => {
    expect(() => createFairProfile(guest(1, { consent: false }))).toThrow(/Consent/);
    expect(() => createFairProfile(guest(1, { age: 17 }))).toThrow(/18/);
  });

  it("five fair guests form a party through the fair's own Group", async () => {
    let partyId: string | null = null;
    for (let n = 1; n <= 5; n++) {
      const p = createFairProfile(guest(n));
      expect(p.groupIds).toEqual(["grp-fair"]);
      const r = await joinQueue({ userId: p.id, eventId: FAIR_EVENT_ID, sentence: "games or anything chill, home by ten", consentBridges: true, startTalk: false });
      partyId = r.partyId ?? partyId;
    }
    expect(partyId).toBeTruthy();
    // An unticked typed fact is never offered as a shareable line.
    const brief = store().briefs.get("brief-fair-1")!;
    expect(brief.shareable.map((l) => l.text).join(" ")).not.toContain("did not approve");
  });
});
