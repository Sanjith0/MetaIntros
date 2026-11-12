import { afterEach, describe, expect, it } from "vitest";
import { DEMO_PARTY as D } from "@/fixtures";
import { runParty } from "@/lib/agents/orchestrator";
import { flag } from "@/lib/flags";
import { chatExpiry, setDemoNow } from "@/lib/server/clock";
import { arrive } from "@/lib/server/door";
import { leaveParty } from "@/lib/server/leave";
import { joinQueue } from "@/lib/server/queue";
import { chatView, partyForViewer, postMessage } from "@/lib/server/social";
import { resetStore, store } from "@/lib/server/store";

async function formed(extra: string[] = []) {
  process.env.PQ_PACE_MS = "0";
  resetStore();
  for (const id of ["dev", "ana", "kai", "zoe", "maya", ...extra]) {
    await joinQueue({ userId: id, eventId: D.entryEventId, sentence: D.sentences[id] ?? "trivia or anything chill, home by eleven", consentBridges: true, startTalk: false });
  }
  return [...store().parties.keys()][0]!;
}

afterEach(() => setDemoNow(null));

describe("chat lifecycle (F8)", () => {
  it("is on by default", () => expect(flag("CHAT_LIFECYCLE")).toBe(true));

  it("leaving before the lock stops the talk and tells the others without naming who left", async () => {
    const pid = await formed();
    const run = runParty(pid, { paceMs: 300 });
    await new Promise((r) => setTimeout(r, 150));
    await leaveParty(pid, "kai");
    await run;
    const s = store();
    const party = s.parties.get(pid)!;
    expect(party.status).toBe("failed");
    expect(party.chatId).toBeNull();
    const ev = s.events_log.filter((e) => e.type === "party.dissolved");
    expect(ev).toHaveLength(1);
    expect(Object.keys(ev[0]!.payload)).toEqual(["partyId"]);
    expect(ev[0]!.audience).toEqual({ kind: "users", userIds: ["dev", "ana", "zoe", "maya"] });
    expect(JSON.stringify(ev[0])).not.toContain("kai");
    // The others are back in the queue at their original place; the leaver is out.
    expect(s.queue.filter((q) => q.status === "waiting").map((q) => q.userId).sort()).toEqual(["ana", "dev", "maya", "zoe"]);
    expect(s.queue.find((q) => q.userId === "kai")!.status).toBe("left");
    expect(partyForViewer("dev")).toBeNull();
    expect(s.events_log.some((e) => e.type === "match.found")).toBe(false);
  });

  it("if a fifth person is waiting, the party re-forms without the leaver", async () => {
    const pid = await formed(["nina"]); // Nina waits; she shares a small Group with Ana
    const { reformedPartyId } = await leaveParty(pid, "kai");
    expect(reformedPartyId).toBeTruthy();
    expect(store().parties.get(reformedPartyId!)!.memberIds.sort()).toEqual(["ana", "dev", "maya", "nina", "zoe"]);
  });

  it("after the lock, you can't leave this way", async () => {
    const pid = await formed();
    await runParty(pid, { paceMs: 0 });
    await expect(leaveParty(pid, "kai")).rejects.toThrow(/already set/);
  });

  it("I'm here posts a ping in the party chat", async () => {
    const pid = await formed();
    await runParty(pid, { paceMs: 0 });
    arrive(pid, "maya");
    const chat = chatView(store().parties.get(pid)!.chatId!, "dev")!;
    expect(chat.messages.at(-1)).toMatchObject({ kind: "system", text: "Maya is here.", senderId: null });
  });

  it("the party chat closes 12 hours after the event and its messages are deleted", async () => {
    expect(chatExpiry("2026-11-14", "18:00", "22:00")).toBe("2026-11-15T18:00:00.000Z"); // 10 AM Pacific the next day
    expect(chatExpiry("2026-11-14", "21:00", "01:00")).toBe("2026-11-15T21:00:00.000Z"); // ends after midnight
    const pid = await formed();
    await runParty(pid, { paceMs: 0 });
    const chatId = store().parties.get(pid)!.chatId!;
    expect(chatView(chatId, "maya")!.expired).toBe(false);
    setDemoNow("2026-11-15T18:01:00.000Z");
    const v = chatView(chatId, "maya")!;
    expect(v.expired).toBe(true);
    expect(store().messages.filter((m) => m.chatId === chatId)).toHaveLength(0);
    expect(() => postMessage(chatId, "maya", "anyone still here?")).toThrow(/closed/);
  });
});
