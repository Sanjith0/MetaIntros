import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_PARTY as D } from "@/fixtures";
import { runParty } from "@/lib/agents/orchestrator";
import { flag } from "@/lib/flags";
import { largestMutualGroup, pairChat, QUEUE_AGAIN_CARD, runItBackView, submitPicks } from "@/lib/server/after";
import { joinQueue } from "@/lib/server/queue";
import { chatView } from "@/lib/server/social";
import { resetStore, store } from "@/lib/server/store";

async function locked() {
  process.env.PQ_PACE_MS = "0";
  resetStore();
  for (const id of ["dev", "ana", "kai", "zoe", "maya"]) {
    await joinQueue({ userId: id, eventId: D.entryEventId, sentence: D.sentences[id]!, consentBridges: true, startTalk: false });
  }
  const pid = [...store().parties.keys()][0]!;
  await runParty(pid, { paceMs: 0 });
  return pid;
}

describe("run it back, plus (F10)", () => {
  beforeEach(() => {
    process.env.PQ_PACE_MS = "0";
  });

  it("is on by default", () => expect(flag("RUN_IT_BACK_PLUS")).toBe(true));

  it("finds the largest group in which everyone picked everyone", () => {
    const edges = new Set(["a|b", "a|c", "b|c", "c|d"]);
    const mutual = (x: string, y: string) => edges.has(`${x}|${y}`) || edges.has(`${y}|${x}`);
    expect(largestMutualGroup(["a", "b", "c", "d", "e"], mutual)).toEqual(["a", "b", "c"]);
    expect(largestMutualGroup(["a", "b", "d"], mutual)).toEqual([]);
  });

  it("three people who all picked each other become a standing party with a chat that doesn't close", async () => {
    const pid = await locked();
    submitPicks(pid, "maya", ["dev", "ana"]);
    submitPicks(pid, "dev", ["maya", "ana"]);
    submitPicks(pid, "ana", ["maya", "dev"]);
    const st = runItBackView(pid, "maya")!.standing!;
    expect(st.memberIds.sort()).toEqual(["ana", "dev", "maya"]);
    const chat = store().chats.get(st.chatId)!;
    expect(chat.expiresAt).toBeNull();
    expect(chatView(st.chatId, "dev")!.messages.at(-1)!.text).toMatch(/standing party/);
    // Outsiders learn nothing about it.
    expect(runItBackView(pid, "kai")!.standing).toBeNull();
    expect(chatView(st.chatId, "kai")).toBeNull();
  });

  it("everyone without a match gets the very same queue-again card", async () => {
    const pid = await locked();
    submitPicks(pid, "zoe", ["kai"]); // Zoe picked Kai; Kai didn't pick Zoe
    submitPicks(pid, "kai", ["dev"]); // Kai picked Dev; Dev didn't pick Kai
    submitPicks(pid, "maya", []); // Maya picked nobody, and nobody picked her
    const cards = ["zoe", "kai", "maya"].map((id) => runItBackView(pid, id)!.queueAgain);
    for (const c of cards) expect(c).toEqual(QUEUE_AGAIN_CARD);
    expect(new Set(cards.map((c) => JSON.stringify(c))).size).toBe(1);
    // And it says nothing about counts, names or timing.
    expect(JSON.stringify(QUEUE_AGAIN_CARD)).not.toMatch(/\d|Kai|Zoe|Maya|Dev|Ana/);
  });

  it("a mutual pair can open a private chat; anyone else can't", async () => {
    const pid = await locked();
    submitPicks(pid, "maya", ["dev"]);
    submitPicks(pid, "dev", ["maya"]);
    const chatId = pairChat(pid, "maya", "dev");
    expect(store().chats.get(chatId)!.memberIds).toEqual(["dev", "maya"]);
    expect(chatView(chatId, "ana")).toBeNull();
    expect(() => pairChat(pid, "maya", "ana")).toThrow(/mutual/);
    expect(runItBackView(pid, "maya")!.queueAgain).toBeNull();
  });
});
