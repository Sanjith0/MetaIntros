import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_PARTY as D } from "@/fixtures";
import { flag } from "@/lib/flags";
import { queuePulse } from "@/lib/server/pulse";
import { joinQueue } from "@/lib/server/queue";
import { profile, resetStore } from "@/lib/server/store";

const join = (id: string, eventId: string = D.entryEventId) => joinQueue({ userId: id, eventId, sentence: D.sentences[id] ?? "anything", consentBridges: true, startTalk: false });

describe("queue pulse on the Event page (F51)", () => {
  beforeEach(() => {
    process.env.PQ_PACE_MS = "0";
    resetStore();
  });

  it("is on by default", () => expect(flag("QUEUE_PULSE")).toBe(true));

  it("counts only, with a floor: nobody, a few, then a number; the viewer isn't counted; other places aren't", async () => {
    expect(queuePulse(D.entryEventId, "maya")!.text).toBe("Be the first in the queue near Dolores Park tonight.");
    await join("dev");
    await join("ana");
    expect(queuePulse(D.entryEventId, "maya")!.text).toBe("A few people are waiting near Dolores Park tonight.");
    await join("kai");
    await join("priya", "evt-lake-games"); // elsewhere that night: not counted
    expect(queuePulse(D.entryEventId, "maya")!).toMatchObject({ waiting: 3, text: "3 people are waiting near Dolores Park tonight." });
    expect(queuePulse(D.entryEventId, "kai")!.waiting).toBe(2); // never counts you
    for (const id of ["dev", "ana", "kai", "priya"]) expect(queuePulse(D.entryEventId, "maya")!.text).not.toContain(profile(id).firstName);
  });

  it("says when parties have formed here, and a whole-night entry counts everywhere that night", async () => {
    for (const id of ["dev", "ana", "kai", "zoe", "maya"]) await join(id);
    await joinQueue({ userId: "sam", eventId: "evt-lake-games", sentence: "anything", consentBridges: true, startTalk: false, scope: "night" });
    // Sam queued for anywhere tonight from the lake, so he counts here too (as "a few": one person).
    expect(queuePulse(D.entryEventId, "priya")!.text).toBe("A few people are waiting near Dolores Park tonight. 1 party has formed here.");
  });
});
