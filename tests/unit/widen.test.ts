import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_PARTY as D } from "@/fixtures";
import { flag } from "@/lib/flags";
import { joinQueue, queueStatus, widenToNight } from "@/lib/server/queue";
import { resetStore, store } from "@/lib/server/store";

const LAKE = "evt-lake-games"; // Lake Merritt, the same evening

describe("widen the search while you wait (F49)", () => {
  beforeEach(() => {
    process.env.PQ_PACE_MS = "0";
    resetStore();
  });

  it("is on by default", () => expect(flag("WIDEN_SEARCH")).toBe(true));

  it("Maya, alone near Dolores Park, widens to anywhere tonight and lands with four waiting at Lake Merritt; her place in line stays", async () => {
    await joinQueue({ userId: "maya", eventId: D.entryEventId, sentence: D.sentences.maya!, consentBridges: true, startTalk: false });
    for (const id of ["dev", "ana", "kai", "zoe"]) await joinQueue({ userId: id, eventId: LAKE, sentence: D.sentences[id]!, consentBridges: true, startTalk: false });
    expect(store().parties.size).toBe(0); // two places, nobody has five
    const before = queueStatus("maya")!.entry;
    const r = await widenToNight("maya", false);
    expect(r.partyId).toBeTruthy();
    const party = store().parties.get(r.partyId!)!;
    expect([...party.memberIds].sort()).toEqual(["ana", "dev", "kai", "maya", "zoe"]);
    expect(store().events.get(party.eventId!)!.landmark).toBe("Lake Merritt"); // the others are tied to the lake, so the plans are the lake's
    const after = store().queue.find((e) => e.id === before.id)!;
    expect(after.scope).toBe("night");
    expect(after.joinedAt).toBe(before.joinedAt);
  });

  it("only while waiting, only once, and not while queuing with a friend or a group", async () => {
    await expect(widenToNight("maya")).rejects.toThrow("while you're waiting");
    await joinQueue({ userId: "maya", eventId: D.entryEventId, sentence: D.sentences.maya!, consentBridges: true, startTalk: false, scope: "night" });
    await expect(widenToNight("maya")).rejects.toThrow("already queued for anywhere tonight");
    await joinQueue({ userId: "zoe", eventId: D.entryEventId, sentence: D.sentences.zoe!, consentBridges: true, startTalk: false, duoWith: "sam" });
    await expect(widenToNight("zoe")).rejects.toThrow("queuing together");
  });
});
