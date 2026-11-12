import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_PARTY as D } from "@/fixtures";
import { runParty } from "@/lib/agents/orchestrator";
import { flag } from "@/lib/flags";
import { joinQueue } from "@/lib/server/queue";
import { profile, resetStore, store } from "@/lib/server/store";
import { askToSwitch, switchState } from "@/lib/server/switchplan";

const FIVE = ["dev", "ana", "kai", "zoe", "maya"];
async function locked() {
  resetStore();
  for (const id of FIVE) await joinQueue({ userId: id, eventId: D.entryEventId, sentence: D.sentences[id]!, consentBridges: true, startTalk: false });
  const pid = [...store().parties.keys()][0]!;
  await runParty(pid, { paceMs: 0 });
  return pid;
}

describe("switch to plan B (F54)", () => {
  beforeEach(() => {
    process.env.PQ_PACE_MS = "0";
  });

  it("is on by default", () => expect(flag("PLAN_B_SWITCH")).toBe(true));

  it("two asks only post a count; the third moves the plan, the RSVPs and the pin; nobody is named", async () => {
    const pid = await locked();
    const s = store();
    const chatId = s.parties.get(pid)!.chatId!;
    expect(askToSwitch(pid, "maya")).toMatchObject({ switched: false, state: { votes: 1, needed: 3, mine: true } });
    expect(switchState(pid, "dev")).toEqual({ votes: 1, needed: 3, mine: false });
    askToSwitch(pid, "dev");
    expect(s.plans.get(s.parties.get(pid)!.planId!)!.title).toBe("Dolores Night Market");
    const r = askToSwitch(pid, "kai");
    expect(r.switched).toBe(true);
    const party = s.parties.get(pid)!;
    expect(s.plans.get(party.planId!)!.title).toBe("Open Studio: Clay and Tea");
    expect(party.status).toBe("locked");
    // RSVPs moved for all five.
    for (const id of FIVE) {
      expect(s.rsvps.get("evt-clay")?.get(id)).toBe("going");
      expect(s.rsvps.get("evt-night-market")?.get(id)).toBeUndefined();
    }
    // The chat: counts, the switch, and the new pin. No names of who asked.
    const lines = s.messages.filter((m) => m.chatId === chatId && m.kind !== "opener").map((m) => m.text);
    expect(lines).toEqual(expect.arrayContaining(["1 of 3 needed asked to switch to plan B: Open Studio: Clay and Tea.", "Switched to plan B: 3 of 5 asked. Your RSVP moved."]));
    const pinned = s.messages.find((m) => m.id === s.chats.get(chatId)!.pinnedMessageId)!;
    expect(pinned.text.startsWith("Open Studio: Clay and Tea")).toBe(true);
    expect(s.chats.get(chatId)!.title).toBe("Open Studio: Clay and Tea · party of 5");
    for (const t of lines.filter((x) => /plan B/.test(x))) for (const id of FIVE) expect(t).not.toContain(profile(id).firstName);
    // One event, no name.
    const ev = s.events_log.filter((e) => e.type === "party.switched");
    expect(ev.map((e) => e.payload)).toEqual([{ partyId: pid }]);
  });

  it("once per person, members only, and only with a plan B", async () => {
    const pid = await locked();
    askToSwitch(pid, "maya");
    expect(() => askToSwitch(pid, "maya")).toThrow("You already asked.");
    expect(() => askToSwitch(pid, "priya")).toThrow("not in this party");
    resetStore();
    for (const id of FIVE) await joinQueue({ userId: id, eventId: D.entryEventId, sentence: D.sentences[id]!, consentBridges: true, startTalk: false });
    expect(() => askToSwitch([...store().parties.keys()][0]!, "maya")).toThrow("There's no plan B");
  });
});
