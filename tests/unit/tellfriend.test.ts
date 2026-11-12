import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_PARTY as D } from "@/fixtures";
import { privatePhrases } from "@/lib/agents/audit";
import { runParty } from "@/lib/agents/orchestrator";
import { flag } from "@/lib/flags";
import { joinQueue } from "@/lib/server/queue";
import { profile, resetStore, store } from "@/lib/server/store";
import { friendMessage } from "@/lib/server/tellfriend";

const FIVE = ["dev", "ana", "kai", "zoe", "maya"];

describe("tell a friend where you'll be (F36)", () => {
  beforeEach(() => {
    process.env.PQ_PACE_MS = "0";
    resetStore();
  });

  it("is on by default", () => expect(flag("TELL_A_FRIEND")).toBe(true));

  it("says where, when and when you'll check in; names nobody and holds nobody's rules", async () => {
    for (const id of FIVE) await joinQueue({ userId: id, eventId: D.entryEventId, sentence: D.sentences[id]!, consentBridges: true, startTalk: false });
    const pid = [...store().parties.keys()][0]!;
    expect(friendMessage(pid, "maya")).toBeNull(); // not before the plan is set
    await runParty(pid, { paceMs: 0 });
    const m = friendMessage(pid, "maya")!;
    expect(m.options.map((o) => o.checkInBy)).toEqual(["10:30 PM", "11 PM", "12 AM"]);
    expect(m.options[0]!.text).toBe(
      "Heads up: I'm going to Dolores Night Market at Dolores Park, upper lawn, Sat, Nov 14, 6 PM–10 PM, with four people I met through Party Queue. It's a public place. I'll text you by 10:30 PM.",
    );
    const all = JSON.stringify(m);
    for (const id of FIVE) {
      expect(all).not.toContain(profile(id).firstName);
      for (const w of privatePhrases(pid, id)) expect(all).not.toContain(w);
    }
    expect(friendMessage(pid, "priya")).toBeNull();
  });
});
