import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_PARTY as D } from "@/fixtures";
import { runParty } from "@/lib/agents/orchestrator";
import { flag } from "@/lib/flags";
import { joinQueue } from "@/lib/server/queue";
import { partyPeople, report, setBlock } from "@/lib/server/safety";
import { everythingVisibleTo } from "@/lib/server/secret";
import { profile, resetStore, store } from "@/lib/server/store";

async function locked() {
  resetStore();
  for (const id of ["dev", "ana", "kai", "zoe", "maya"]) {
    await joinQueue({ userId: id, eventId: D.entryEventId, sentence: D.sentences[id]!, consentBridges: true, startTalk: false });
  }
  const pid = [...store().parties.keys()][0]!;
  await runParty(pid, { paceMs: 0 });
  return pid;
}

beforeEach(() => {
  process.env.PQ_PACE_MS = "0";
});

describe("safety (F15)", () => {
  it("is on by default", () => expect(flag("SAFETY_PAGE")).toBe(true));

  it("you can only report people you've been in a party with", async () => {
    await locked();
    expect(partyPeople("maya").sort()).toEqual(["ana", "dev", "kai", "zoe"]);
    expect(() => report({ reporterId: "maya", subjectId: "priya", reason: "spam" })).toThrow(/party with/);
  });

  it("a report is stored for review, blocks if asked, and the reported person is never told", async () => {
    const pid = await locked();
    const before = store().events_log.length;
    const r = report({ reporterId: "maya", subjectId: "dev", reason: "uncomfortable", note: "kept interrupting", alsoBlock: true });
    expect(r.blocked).toBe(true);
    expect(profile("maya").blocks).toContain("dev");
    expect(store().reports).toHaveLength(1);
    expect(store().events_log.length).toBe(before); // no event to anyone
    for (const id of D.memberIds) {
      const seen = everythingVisibleTo(pid, id).text;
      expect(seen).not.toContain("kept interrupting");
      expect(seen).not.toContain("uncomfortable");
    }
  });

  it("a block keeps two people out of the same party", async () => {
    resetStore();
    setBlock("ana", "kai", true);
    let partyId: string | null = null;
    for (const id of ["dev", "ana", "kai", "zoe", "maya"]) {
      partyId = (await joinQueue({ userId: id, eventId: D.entryEventId, sentence: D.sentences[id]!, consentBridges: true, startTalk: false })).partyId ?? partyId;
    }
    expect(partyId).toBeNull();
    setBlock("ana", "kai", false);
    expect(profile("ana").blocks).not.toContain("kai");
  });

  it("you can't block yourself", () => {
    resetStore();
    expect(() => setBlock("maya", "maya", true)).toThrow();
  });
});
