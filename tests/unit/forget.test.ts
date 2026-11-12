import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_PARTY as D } from "@/fixtures";
import { runParty } from "@/lib/agents/orchestrator";
import { flag } from "@/lib/flags";
import { canForget, forgetNight, isForgotten, scanStore } from "@/lib/server/forget";
import { joinQueue } from "@/lib/server/queue";
import { secretView } from "@/lib/server/secret";
import { postMessage } from "@/lib/server/social";
import { resetStore, store } from "@/lib/server/store";
import { whyThisPlan } from "@/lib/server/why";

const FIVE = ["dev", "ana", "kai", "zoe", "maya"];
const MAYA = ["out by eleven", "under twenty bucks", "nowhere I have to drink", D.sentences.maya!];

async function locked() {
  resetStore();
  for (const id of FIVE) await joinQueue({ userId: id, eventId: D.entryEventId, sentence: D.sentences[id]!, consentBridges: true, startTalk: false });
  const pid = [...store().parties.keys()][0]!;
  await runParty(pid, { paceMs: 0 });
  return pid;
}

describe("forget my night (F24)", () => {
  beforeEach(() => {
    process.env.PQ_PACE_MS = "0";
  });

  it("is on by default", () => expect(flag("FORGET_ME")).toBe(true));

  it("the scan is real: before, Maya's words are all over the server; after, none are", async () => {
    const pid = await locked();
    const before = scanStore(MAYA);
    expect(before.found.length).toBeGreaterThan(10);
    expect(new Set(before.found.map((f) => f.where.split(/[.[{]/)[0]))).toEqual(new Set(["briefs", "verdicts", "traces", "receipts", "prompts", "events_log"]));
    const r = forgetNight(pid, "maya");
    expect(r.found).toEqual([]);
    expect(r.checked).toBeGreaterThan(2000);
    expect(scanStore(MAYA).found).toEqual([]);
    expect(r.removed.map((x) => x.label)).toEqual([
      "your sentence",
      "your rules",
      "your preferences",
      "your agent's private reasons",
      "code's checks of your rules",
      "private updates sent only to you",
      "your receipt",
      "the exact prompts your agent got",
      "private projector notes",
    ]);
    expect(isForgotten(pid, "maya")).toBe(true);
  });

  it("keeps the plan, the RSVP, what she chose to share, and everyone else's data", async () => {
    const pid = await locked();
    const s = store();
    const party = JSON.stringify(s.parties.get(pid));
    const table = JSON.stringify(s.table);
    const others = FIVE.filter((id) => id !== "maya").map((id) => JSON.stringify([s.briefs.get(`brief-${id}`), s.receipts.get(`${pid}:${id}`), s.verdicts.filter((v) => v.ownerId === id)]));
    forgetNight(pid, "maya");
    expect(JSON.stringify(s.parties.get(pid))).toBe(party);
    expect(JSON.stringify(s.table)).toBe(table); // her approved lines at the table stay
    expect(FIVE.filter((id) => id !== "maya").map((id) => JSON.stringify([s.briefs.get(`brief-${id}`), s.receipts.get(`${pid}:${id}`), s.verdicts.filter((v) => v.ownerId === id)]))).toEqual(others);
    // Dev's own pages still work, and his "why this plan" still says everyone else's rules passed.
    expect(secretView(pid, "dev")!.partyKnows).toEqual([]);
    expect(whyThisPlan(pid, "dev")!.lines.find((l) => l.id === "others")!.ok).toBe(true);
  });

  it("is honest about what it keeps: words she typed into the chat herself are reported, not hidden", async () => {
    const pid = await locked();
    postMessage(store().parties.get(pid)!.chatId!, "maya", "fyi I'm out by eleven tonight");
    const r = forgetNight(pid, "maya");
    // Both copies: the message, and the chat event that delivered it.
    expect(r.found).toEqual([
      { where: expect.stringMatching(/^messages\[\d+\]\.text$/), text: "out by eleven" },
      { where: expect.stringMatching(/^events_log\[\d+\]\.payload\.text$/), text: "out by eleven" },
    ]);
  });

  it("only after the plan is set, only once, only your own party", async () => {
    resetStore();
    for (const id of FIVE) await joinQueue({ userId: id, eventId: D.entryEventId, sentence: D.sentences[id]!, consentBridges: true, startTalk: false });
    const early = [...store().parties.keys()][0]!;
    expect(canForget(early, "maya")).toBe("While your party is still talking, use Leave instead.");
    const pid = await locked();
    expect(canForget(pid, "priya")).toBe("Not your party.");
    forgetNight(pid, "maya");
    expect(() => forgetNight(pid, "maya")).toThrow("Already forgotten.");
  });
});
