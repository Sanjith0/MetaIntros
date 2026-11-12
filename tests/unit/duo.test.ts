import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_PARTY as D, PROFILES } from "@/fixtures";
import { entryFor } from "@/fixtures/queue-cases";
import { bridgeText } from "@/lib/agents/pair";
import { flag } from "@/lib/flags";
import { checkParty, formParty, type Candidate } from "@/lib/queue/formation";
import { joinQueue, queueStatus } from "@/lib/server/queue";
import { profile, resetStore, store } from "@/lib/server/store";

const prof = (id: string) => structuredClone(PROFILES.find((p) => p.id === id)!);
const cand = (id: string, i: number, duoWith: string | null = null): Candidate => ({ profile: prof(id), entry: entryFor(id, i, { duoWith }) });

describe("duo queue (F6)", () => {
  it("is on by default", () => expect(flag("DUO_QUEUE")).toBe(true));

  it("a confirmed duo lands in the same party, with a 'queued together' tie", () => {
    const formed = formParty([cand("dev", 0), cand("ana", 1), cand("kai", 2), cand("zoe", 3, "sam"), cand("sam", 4, "zoe")])!;
    expect(formed.members.map((m) => m.profile.id).sort()).toEqual(["ana", "dev", "kai", "sam", "zoe"]);
    const tie = formed.bridges.find((b) => b.kind === "queued_together")!;
    expect([tie.a, tie.b].sort()).toEqual(["sam", "zoe"]);
    expect(bridgeText(tie)).toBe("You queued together.");
  });

  it("someone who invited a friend waits until the friend joins", () => {
    // Zoe invited Sam, who hasn't joined: the other four can't use Zoe to make five.
    expect(formParty([cand("maya", 0), cand("dev", 1), cand("ana", 2), cand("kai", 3), cand("zoe", 4, "sam")])).toBeNull();
  });

  it("a duo is both or neither: never split across parties", () => {
    const formed = formParty([cand("maya", 0), cand("dev", 1), cand("ana", 2), cand("kai", 3), cand("zoe", 4, "sam"), cand("sam", 5, "zoe")])!;
    const ids = formed.members.map((m) => m.profile.id);
    expect(ids.includes("zoe")).toBe(ids.includes("sam"));
  });

  it("checkParty flags a split duo", () => {
    const members = [cand("maya", 0), cand("dev", 1), cand("ana", 2), cand("kai", 3), cand("zoe", 4, "sam")];
    expect(checkParty(members).map((v) => v.rule)).toContain("duo");
  });
});

describe("queue sheet settings and invites (F6)", () => {
  beforeEach(() => {
    resetStore();
  });

  it("you can only queue with a friend", async () => {
    await expect(joinQueue({ userId: "zoe", eventId: D.entryEventId, sentence: "anything chill", consentBridges: true, duoWith: "dev", startTalk: false })).rejects.toThrow(/friend/);
  });

  it("inviting a friend sends them a queue.invite; their join confirms the duo and forms the party", async () => {
    for (const id of ["dev", "ana", "kai"]) await joinQueue({ userId: id, eventId: D.entryEventId, sentence: D.sentences[id]!, consentBridges: true, startTalk: false });
    await joinQueue({ userId: "zoe", eventId: D.entryEventId, sentence: D.sentences.zoe!, consentBridges: true, duoWith: "sam", startTalk: false });
    const invite = store().events_log.find((e) => e.type === "queue.invite")!;
    expect(invite.payload).toMatchObject({ fromId: "zoe", toId: "sam" });
    expect(invite.audience).toEqual({ kind: "users", userIds: ["sam"] });
    expect(queueStatus("zoe")!.duo).toEqual({ with: "sam", confirmed: false });
    expect(store().parties.size).toBe(0);

    const r = await joinQueue({ userId: "sam", eventId: D.entryEventId, sentence: "podcasts and a walk, home by eleven", consentBridges: true, duoWith: "zoe", startTalk: false });
    expect(r.partyId).toBeTruthy();
    expect(store().parties.get(r.partyId!)!.memberIds.sort()).toEqual(["ana", "dev", "kai", "sam", "zoe"]);
    expect(store().events_log.filter((e) => e.type === "queue.invite")).toHaveLength(1);
  });

  it("women-only from the sheet is saved and keeps her out of a mixed party", async () => {
    for (const id of ["dev", "kai", "zoe", "maya"]) await joinQueue({ userId: id, eventId: D.entryEventId, sentence: D.sentences[id]!, consentBridges: true, startTalk: false });
    const r = await joinQueue({ userId: "ana", eventId: D.entryEventId, sentence: D.sentences.ana!, consentBridges: true, settings: { womenOnly: true, notOnlyWoman: false }, startTalk: false });
    expect(profile("ana").settings.womenOnly).toBe(true);
    expect(r.partyId).toBeNull();
  });
});
