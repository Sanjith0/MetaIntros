import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_PARTY as D } from "@/fixtures";
import { flag } from "@/lib/flags";
import { joinQueue, queueStatus } from "@/lib/server/queue";
import { resetStore, store } from "@/lib/server/store";

const join = (userId: string, extra: { friendIds?: string[]; groupOf?: string; duoWith?: string } = {}) =>
  joinQueue({ userId, eventId: D.entryEventId, sentence: D.sentences[userId] ?? "anything chill works for me", consentBridges: true, startTalk: false, ...extra });

describe("bring up to three friends (F44)", () => {
  beforeEach(() => {
    process.env.PQ_PACE_MS = "0";
    resetStore();
  });

  it("is on by default", () => expect(flag("FRIEND_GROUP")).toBe(true));

  it("Sam brings Zoe and Ana: they're invited, the group waits for both, then lands together with new people", async () => {
    const r = await join("sam", { friendIds: ["zoe", "ana"] });
    const group = r.entry.groupOf!;
    expect(group).toMatch(/^grp-sam-/);
    expect(store().friendGroups.get(group)).toEqual({ by: "sam", memberIds: ["sam", "zoe", "ana"] });
    const invites = store().events_log.filter((e) => e.type === "queue.invite").map((e) => e.payload as { toId: string; groupOf?: string });
    expect(invites.map((i) => i.toId).sort()).toEqual(["ana", "zoe"]);
    expect(invites.every((i) => i.groupOf === group)).toBe(true);
    // Strangers arrive; nothing forms until Zoe and Ana are both in.
    await join("dev");
    await join("kai");
    expect((await join("zoe", { groupOf: group })).partyId).toBeNull();
    expect(queueStatus("sam")!.group).toEqual({ of: group, joined: ["sam", "zoe"], waitingFor: ["ana"] });
    const last = await join("ana", { groupOf: group });
    const party = store().parties.get(last.partyId!)!;
    expect([...party.memberIds].sort()).toEqual(["ana", "dev", "kai", "sam", "zoe"]);
    expect(party.bridges.filter((b) => b.kind === "queued_together").map((b) => `${b.a}-${b.b}`).sort()).toEqual(["ana-sam", "ana-zoe", "sam-zoe"]);
    // Each still has their own private brief.
    expect(store().briefs.get("brief-zoe")!.sentence).toBe(D.sentences.zoe);
  });

  it("only friends, two or three of them, not with a duo too, and only people in the group can join it", async () => {
    await expect(join("sam", { friendIds: ["zoe", "maya"] })).rejects.toThrow("You can only queue with friends.");
    await expect(join("sam", { friendIds: ["zoe", "ana", "priya", "nina"] })).rejects.toThrow("Bring up to three friends.");
    await expect(join("sam", { friendIds: ["zoe", "ana"], duoWith: "nina" })).rejects.toThrow("not both");
    const r = await join("sam", { friendIds: ["zoe", "ana"] });
    await expect(join("maya", { groupOf: r.entry.groupOf! })).rejects.toThrow();
  });
});
