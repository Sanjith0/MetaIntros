import { beforeEach, describe, expect, it } from "vitest";
import { QUEUE_CASES, entryFor } from "@/fixtures/queue-cases";
import { DEMO_PARTY, GROUPS, PROFILES } from "@/fixtures";
import { checkParty, eligibleToQueue, formParty, type Candidate } from "@/lib/queue/formation";
import { sharedSmallGroups } from "@/lib/graph";
import { resetStore, store } from "@/lib/server/store";
import { joinQueue, queueStatus } from "@/lib/server/queue";
import { DEMO_PARTY as D } from "@/fixtures/demo";

const profile = (id: string) => structuredClone(PROFILES.find((p) => p.id === id)!);

describe("queue: party formation rules", () => {
  for (const c of QUEUE_CASES) {
    it(`${c.expect}: ${c.name}`, () => {
      const rules = checkParty(c.members).map((v) => v.rule);
      if (c.expect === "valid") expect(rules).toEqual([]);
      else expect([...new Set(rules)]).toEqual([c.expect]);
    });
  }

  it("has one failing fixture for every rule", () => {
    const covered = new Set(QUEUE_CASES.map((c) => c.expect));
    for (const r of ["size", "bucket", "window", "age", "blocks", "women_only", "not_only_woman", "bridge"]) expect(covered.has(r as never)).toBe(true);
  });

  it("a Group of exactly 200 is not small; 199 is", () => {
    const a = { ...profile("maya"), groupIds: ["grp-big-climbing"] };
    const b = { ...profile("dev"), groupIds: ["grp-big-climbing"] };
    expect(GROUPS.find((g) => g.id === "grp-big-climbing")!.size).toBe(200);
    expect(sharedSmallGroups(a, b)).toEqual([]);
    const c = { ...profile("maya"), groupIds: ["grp-runners"] };
    const d = { ...profile("dev"), groupIds: ["grp-runners"] };
    expect(sharedSmallGroups(c, d).map((g) => g.size)).toEqual([199]);
  });

  it("under-18s cannot join the queue", () => {
    expect(eligibleToQueue(profile("lena"))?.rule).toBe("age");
    expect(eligibleToQueue(profile("maya"))).toBeNull();
  });
});

describe("queue: forming a party from a bucket", () => {
  const cand = (id: string, i: number, over = {}): Candidate => ({ profile: profile(id), entry: entryFor(id, i, over) });

  it("forms the demo party from the Dolores Park bucket", () => {
    const formed = formParty(DEMO_PARTY.memberIds.map((id, i) => cand(id, i)));
    expect(formed?.members.map((m) => m.profile.id).sort()).toEqual([...DEMO_PARTY.memberIds].sort());
    // Every member has at least one bridge.
    for (const id of DEMO_PARTY.memberIds) expect(formed!.bridges.some((b) => b.a === id || b.b === id)).toBe(true);
  });

  it("skips people who break a rule and still forms a party", () => {
    // Omar blocked Ana and joined first; Jules has no bridge; Lena is 17.
    const cands = [cand("omar", 0), cand("jules", 1), cand("lena", 2), ...DEMO_PARTY.memberIds.map((id, i) => cand(id, i + 3))];
    const formed = formParty(cands);
    const ids = formed!.members.map((m) => m.profile.id);
    expect(ids).not.toContain("lena");
    expect(ids).not.toContain("jules");
    expect(ids.includes("omar") && ids.includes("ana")).toBe(false);
  });

  it("does not mix buckets", () => {
    const cands = DEMO_PARTY.memberIds.map((id, i) => cand(id, i, id === "zoe" ? { landmark: "Ferry Building" } : {}));
    expect(formParty(cands)).toBeNull();
  });

  it("waits when the bucket has fewer than five", () => {
    expect(formParty(DEMO_PARTY.memberIds.slice(0, 4).map((id, i) => cand(id, i)))).toBeNull();
  });
});

describe("queue: joining through the server", () => {
  beforeEach(() => {
    resetStore();
  });

  it("joins, reports the bucket, and forms a party on the fifth join", async () => {
    for (const id of ["dev", "ana", "kai", "zoe"]) await joinQueue({ userId: id, eventId: D.entryEventId, sentence: D.sentences[id]!, consentBridges: true, startTalk: false });
    expect(queueStatus("dev")?.inBucket).toBe(4);
    const res = await joinQueue({ userId: "maya", eventId: D.entryEventId, sentence: D.sentences.maya!, consentBridges: true, startTalk: false });
    expect(res.partyId).toBeTruthy();
    const party = store().parties.get(res.partyId!)!;
    expect(party.memberIds.sort()).toEqual([...D.memberIds].sort());
    expect(store().events_log.some((e) => e.type === "party.forming")).toBe(true);
  });

  it("refuses a 17-year-old", async () => {
    await expect(joinQueue({ userId: "lena", eventId: D.entryEventId, sentence: "anything", consentBridges: true, startTalk: false })).rejects.toThrow(/18/);
  });
});
