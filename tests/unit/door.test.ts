import { beforeEach, describe, expect, it } from "vitest";
import { Spotted } from "@/contracts";
import { DEMO_PARTY as D } from "@/fixtures";
import fixtureFrame from "@/fixtures/frames/dev-at-door.json";
import { matchFrame, setMatcher, stubMatcher } from "@/lib/door/recognition";
import { runParty } from "@/lib/agents/orchestrator";
import { visibleTo } from "@/lib/server/bus";
import { arrive, spotByTap, spotFromFrame } from "@/lib/server/door";
import { joinQueue } from "@/lib/server/queue";
import { resetStore, store } from "@/lib/server/store";
import { memberPartyView } from "@/lib/server/views";

const gallery = ["dev", "ana", "kai", "zoe"].map((userId) => ({ userId }));

async function lockedDemoParty() {
  resetStore();
  setMatcher(stubMatcher);
  for (const id of ["dev", "ana", "kai", "zoe", "maya"]) {
    await joinQueue({ userId: id, eventId: D.entryEventId, sentence: D.sentences[id]!, consentBridges: true, startTalk: false });
  }
  const pid = [...store().parties.keys()][0]!;
  await runParty(pid, { paceMs: 0 });
  return pid;
}

describe("door: matchFrame stub", () => {
  it("maps the fixture frame to Dev without reading pixels", async () => {
    const a = await matchFrame({ ...fixtureFrame, partyId: "p" }, gallery);
    const b = await matchFrame({ ...fixtureFrame, partyId: "p", image: "data:image/png;base64,AAAA" }, gallery);
    expect(a).toEqual({ subjectId: "dev" });
    expect(b).toEqual(a);
  });

  it("returns nobody for an unknown frame or someone outside the gallery", async () => {
    expect(await matchFrame({ ...fixtureFrame, partyId: "p", fixtureKey: undefined }, gallery)).toEqual({ subjectId: null });
    expect(await matchFrame({ ...fixtureFrame, partyId: "p" }, [{ userId: "ana" }])).toEqual({ subjectId: null });
  });

  it("a plugged-in matcher can only name gallery members", async () => {
    setMatcher({ name: "rogue", match: async () => ({ subjectId: "priya" }) });
    expect(await matchFrame({ ...fixtureFrame, partyId: "p" }, gallery)).toEqual({ subjectId: null });
    setMatcher(stubMatcher);
  });
});

describe("door: spotting at the event", () => {
  beforeEach(() => {
    process.env.PQ_PACE_MS = "0";
  });

  it("posting the fixture frame spots Dev for Maya only, and her card for Dev is ready", async () => {
    const pid = await lockedDemoParty();
    const spotted = await spotFromFrame({ ...fixtureFrame, partyId: pid });
    expect(Spotted.parse(spotted)).toMatchObject({ viewerId: "maya", subjectId: "dev", method: "stub" });
    // Nothing else: no attributes inferred from a face.
    expect(Object.keys(spotted).sort()).toEqual(["at", "frameId", "method", "partyId", "subjectId", "viewerId"]);
    const ev = store().events_log.filter((e) => e.type === "member.spotted").at(-1)!;
    expect(visibleTo(ev, { userId: "maya" })).toBe(true);
    expect(visibleTo(ev, { userId: "dev" })).toBe(false);
    const card = memberPartyView(pid, "maya")!.cards.find((c) => c.subjectId === "dev")!;
    expect(card.opener).toMatch(/^Dev, /);
    expect(card.sourceIds.length).toBeGreaterThan(0);
  });

  it("I'm here tells the party; tap-a-face works without a camera", async () => {
    const pid = await lockedDemoParty();
    arrive(pid, "maya");
    expect(memberPartyView(pid, "dev")!.members.find((m) => m.id === "maya")!.arrived).toBe(true);
    expect(spotByTap(pid, "maya", "zoe")).toMatchObject({ subjectId: "zoe", method: "tap" });
    expect(() => spotByTap(pid, "maya", "priya")).toThrow();
  });
});
