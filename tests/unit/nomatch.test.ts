import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_PARTY as D } from "@/fixtures";
import { runParty } from "@/lib/agents/orchestrator";
import { flag, setFlagOverride } from "@/lib/flags";
import { noMatchView } from "@/lib/server/nomatch";
import { joinQueue, setKey } from "@/lib/server/queue";
import { resetStore, store } from "@/lib/server/store";

const FIVE = ["dev", "ana", "kai", "zoe", "maya"];

async function party(sentences: Record<string, string> = {}) {
  resetStore();
  for (const id of FIVE) await joinQueue({ userId: id, eventId: D.entryEventId, sentence: sentences[id] ?? D.sentences[id]!, consentBridges: true, startTalk: false });
  const pid = [...store().parties.keys()][0]!;
  await runParty(pid, { paceMs: 0 });
  return pid;
}

describe("no match, nobody blamed (F22)", () => {
  beforeEach(() => {
    process.env.PQ_PACE_MS = "0";
    setFlagOverride("NO_MATCH", null);
  });

  it("is on by default", () => expect(flag("NO_MATCH")).toBe(true));

  it("when no plan fits all five, all five go back to the front of the queue and these five never re-form", async () => {
    const pid = await party(D.clashSentences);
    const s = store();
    expect(s.parties.get(pid)!.status).toBe("failed");
    const entries = s.queue.filter((e) => FIVE.includes(e.userId));
    expect(entries.map((e) => e.status)).toEqual(["waiting", "waiting", "waiting", "waiting", "waiting"]);
    // They keep their original join times, so they're ahead of anyone who joins now.
    expect(entries.map((e) => e.joinedAt)).toEqual([...entries.map((e) => e.joinedAt)].sort());
    expect(s.avoidSets.has(setKey(FIVE))).toBe(true);
    expect(s.parties.size).toBe(1); // the same five were not put together again
    // One event, to the five, with no reason and no name.
    const ev = s.events_log.filter((e) => e.type === "party.nomatch");
    expect(ev).toHaveLength(1);
    expect(ev[0]!.payload).toEqual({ partyId: pid });
    expect(ev[0]!.audience).toEqual({ kind: "users", userIds: expect.arrayContaining(FIVE) });
    expect(s.traces.some((t) => t.lane === "shared" && t.title === "No match · nobody blamed")).toBe(true);
    for (const id of FIVE) expect(noMatchView(pid, id)).toMatchObject({ requeued: true, ownRules: null, landmark: "Dolores Park" });
  });

  it("a sixth person in the same place makes a new party, never the same five", async () => {
    const pid = await party(D.clashSentences);
    const r = await joinQueue({ userId: "sam", eventId: D.entryEventId, sentence: "anything chill works for me", consentBridges: true, startTalk: false });
    expect(r.partyId).toBeTruthy();
    const next = store().parties.get(r.partyId!)!;
    expect(next.id).not.toBe(pid);
    expect(next.memberIds).toContain("sam");
    expect(setKey(next.memberIds)).not.toBe(setKey(FIVE));
  });

  it("someone whose own rules close every plan is told privately, with their own rules; the others never learn it", async () => {
    const pid = await party({ zoe: "open to anything, home by nine" });
    const s = store();
    expect(s.queue.find((e) => e.userId === "zoe")!.status).toBe("left");
    expect(s.queue.filter((e) => e.userId !== "zoe").map((e) => e.status)).toEqual(["waiting", "waiting", "waiting", "waiting"]);
    expect(noMatchView(pid, "zoe")).toEqual({ requeued: false, ownRules: ["Done by 9 PM"], landmark: "Dolores Park", eventId: D.entryEventId });
    for (const id of ["maya", "dev", "ana", "kai"]) {
      const v = noMatchView(pid, id)!;
      expect(v).toMatchObject({ requeued: true, ownRules: null });
      expect(JSON.stringify(v)).not.toMatch(/zoe|nine|9 PM/i);
    }
    // The projector says who; the shared lane does not.
    expect(s.traces.find((t) => t.title === "Nothing here fits Zoe's own rules")?.lane).toBe("private");
    for (const t of s.traces.filter((x) => x.lane === "shared")) expect(t.body).not.toMatch(/home by nine|9 PM/);
    expect(s.traces.find((t) => t.title === "No match · nobody blamed")!.body).not.toMatch(/Zoe/);
  });

  it("a party that locks is untouched", async () => {
    const pid = await party();
    expect(store().parties.get(pid)!.status).toBe("locked");
    expect(store().avoidSets.size).toBe(0);
    expect(noMatchView(pid, "maya")).toBeNull();
  });

  it("switched off, there is no no-match event and nobody is re-queued", async () => {
    setFlagOverride("NO_MATCH", false);
    await party(D.clashSentences);
    expect(store().events_log.some((e) => e.type === "party.nomatch")).toBe(false);
    expect(store().avoidSets.size).toBe(0);
    setFlagOverride("NO_MATCH", null);
  });
});
