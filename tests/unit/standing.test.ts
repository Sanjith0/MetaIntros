import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_PARTY as D } from "@/fixtures";
import { runParty } from "@/lib/agents/orchestrator";
import { flag } from "@/lib/flags";
import { submitPicks } from "@/lib/server/after";
import { joinQueue, queueStatus } from "@/lib/server/queue";
import { resetStore, store } from "@/lib/server/store";

const FIVE = ["dev", "ana", "kai", "zoe", "maya"];
const SUNDAY = "evt-ferry-trivia";

/** The demo party locks; Maya, Dev and Ana all pick each other and become a standing party. */
async function standing() {
  resetStore();
  for (const id of FIVE) await joinQueue({ userId: id, eventId: D.entryEventId, sentence: D.sentences[id]!, consentBridges: true, startTalk: false });
  const pid = [...store().parties.keys()][0]!;
  await runParty(pid, { paceMs: 0 });
  submitPicks(pid, "maya", ["dev", "ana"]);
  submitPicks(pid, "dev", ["maya", "ana"]);
  submitPicks(pid, "ana", ["maya", "dev"]);
  expect(store().standing.get(pid)?.memberIds.sort()).toEqual(["ana", "dev", "maya"]);
  return pid;
}
const join = (userId: string, sentence: string, groupOf: string | null = null) => joinQueue({ userId, eventId: SUNDAY, sentence, consentBridges: true, groupOf, startTalk: false });

describe("standing party queues together (F26)", () => {
  beforeEach(() => {
    process.env.PQ_PACE_MS = "0";
  });

  it("is on by default", () => expect(flag("STANDING_QUEUE")).toBe(true));

  it("the first one in invites the others, and the group waits until all three have joined", async () => {
    const pid = await standing();
    await join("dev", "trivia sounds fun, under 30", pid);
    const invites = store().events_log.filter((e) => e.type === "queue.invite" && e.payload.groupOf === pid);
    expect(invites.map((e) => (e.payload as { toId: string }).toId).sort()).toEqual(["ana", "maya"]);
    // Two new people arrive; with only Dev of the three in, nobody forms.
    expect((await join("priya", "anything social, out by 11")).partyId).toBeNull();
    expect((await join("theo", "games or quiz night")).partyId).toBeNull();
    expect(queueStatus("dev")!.group).toEqual({ of: pid, joined: ["dev"], waitingFor: expect.arrayContaining(["maya", "ana"]) });
    expect((await join("ana", "low-key, home by midnight", pid)).partyId).toBeNull();
    // Maya joins last: the three land together with the two new people.
    const r = await join("maya", "chill, out by eleven, under twenty bucks", pid);
    const party = store().parties.get(r.partyId!)!;
    expect([...party.memberIds].sort()).toEqual(["ana", "dev", "maya", "priya", "theo"]);
    const together = party.bridges.filter((b) => b.kind === "queued_together").map((b) => `${b.a}-${b.b}`).sort();
    expect(together).toEqual(["ana-dev", "ana-maya", "dev-maya"]);
    // Each still has their own private brief from their own sentence.
    expect(store().briefs.get("brief-maya")!.sentence).toBe("chill, out by eleven, under twenty bucks");
  });

  it("all of the group or none: a group never splits across parties", async () => {
    const pid = await standing();
    await join("dev", "trivia sounds fun", pid);
    await join("ana", "low-key", pid);
    // Three solo people who could make five with Dev and Ana: no party without Maya.
    for (const id of ["priya", "theo", "nina"]) await join(id, "anything social");
    expect([...store().parties.values()].filter((p) => p.memberIds.includes("dev") && p.id !== pid)).toHaveLength(0);
    const r = await join("maya", "chill", pid);
    const party = store().parties.get(r.partyId!)!;
    expect(party.memberIds).toEqual(expect.arrayContaining(["dev", "ana", "maya"]));
    expect(party.memberIds).toHaveLength(5);
  });

  it("only your own standing party, and not with a friend at the same time", async () => {
    const pid = await standing();
    await expect(join("kai", "trivia", pid)).rejects.toThrow("You can only queue with your own standing party.");
    await expect(joinQueue({ userId: "dev", eventId: SUNDAY, sentence: "trivia", consentBridges: true, groupOf: pid, duoWith: "maya", startTalk: false })).rejects.toThrow("not both");
    await expect(join("dev", "trivia", "party-nope")).rejects.toThrow("own standing party");
  });
});
