import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_PARTY as D } from "@/fixtures";
import { runParty } from "@/lib/agents/orchestrator";
import { flag } from "@/lib/flags";
import { arrive } from "@/lib/server/door";
import { doorState, runningLate, setMeetSpot } from "@/lib/server/meet";
import { joinQueue } from "@/lib/server/queue";
import { resetStore, store } from "@/lib/server/store";

const FIVE = ["dev", "ana", "kai", "zoe", "maya"];
async function locked() {
  resetStore();
  for (const id of FIVE) await joinQueue({ userId: id, eventId: D.entryEventId, sentence: D.sentences[id]!, consentBridges: true, startTalk: false });
  const pid = [...store().parties.keys()][0]!;
  return pid;
}

describe("find each other at the venue (F37)", () => {
  beforeEach(() => {
    process.env.PQ_PACE_MS = "0";
  });

  it("is on by default", () => expect(flag("FIND_EACH_OTHER")).toBe(true));

  it("running late and where to meet reach the chat and every door screen; arriving clears late", async () => {
    const pid = await locked();
    expect(() => runningLate(pid, "dev", 10)).toThrow("Your plan isn't set yet.");
    await runParty(pid, { paceMs: 0 });
    const s = store();
    const chatId = s.parties.get(pid)!.chatId!;
    runningLate(pid, "dev", 10);
    setMeetSpot(pid, "maya", "  by the big   fountain, blue jacket ");
    expect(doorState(pid)).toEqual({ late: { dev: 10 }, meet: { text: "by the big fountain, blue jacket", by: "maya", byName: "Maya" } });
    const texts = s.messages.filter((m) => m.chatId === chatId && m.kind === "user").map((m) => `${m.senderId}: ${m.text}`);
    expect(texts).toEqual(["dev: Running about 10 minutes late.", "maya: Let's meet: by the big fountain, blue jacket"]);
    const ev = s.events_log.filter((e) => e.type === "door.update");
    expect(ev.map((e) => e.payload)).toEqual([
      { partyId: pid, userId: "dev", lateMinutes: 10, meetSpot: null },
      { partyId: pid, userId: "maya", lateMinutes: null, meetSpot: "by the big fountain, blue jacket" },
    ]);
    for (const e of ev) expect(e.audience).toEqual({ kind: "users", userIds: expect.arrayContaining(FIVE) });
    arrive(pid, "dev");
    expect(doorState(pid).late).toEqual({});
  });

  it("only 10, 20 or 30 minutes; a spot of 3 to 80 characters; only your own party", async () => {
    const pid = await locked();
    await runParty(pid, { paceMs: 0 });
    expect(() => runningLate(pid, "dev", 45)).toThrow("Pick 10, 20 or 30 minutes.");
    expect(() => setMeetSpot(pid, "dev", "x")).toThrow("3 to 80");
    expect(() => setMeetSpot(pid, "dev", "y".repeat(81))).toThrow("3 to 80");
    expect(() => runningLate(pid, "priya", 10)).toThrow("not in this party");
  });
});
