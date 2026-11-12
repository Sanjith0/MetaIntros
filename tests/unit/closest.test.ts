import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_PARTY as D } from "@/fixtures";
import { privatePhrases } from "@/lib/agents/audit";
import { runParty } from "@/lib/agents/orchestrator";
import { flag } from "@/lib/flags";
import { closestFit } from "@/lib/server/closest";
import { joinQueue } from "@/lib/server/queue";
import { resetStore, store } from "@/lib/server/store";

const FIVE = ["dev", "ana", "kai", "zoe", "maya"];
async function party(sentences: Record<string, string>) {
  resetStore();
  for (const id of FIVE) await joinQueue({ userId: id, eventId: D.entryEventId, sentence: sentences[id] ?? D.sentences[id]!, consentBridges: true, startTalk: false });
  const pid = [...store().parties.keys()][0]!;
  await runParty(pid, { paceMs: 0 });
  return pid;
}

describe("closest fit (F45)", () => {
  beforeEach(() => {
    process.env.PQ_PACE_MS = "0";
  });

  it("is on by default", () => expect(flag("CLOSEST_FIT")).toBe(true));

  it("home by nine closes every plan; the clay studio is closest: stay until 9:30", async () => {
    const pid = await party({ zoe: "open to anything, home by nine" });
    expect(closestFit(pid, "zoe")).toEqual({ planTitle: "Open Studio: Clay and Tea", changes: ["stay until 9:30 PM (you said “home by nine”)"] });
  });

  it("weighs every broken rule: a plan that breaks two is never closer than one that breaks one", async () => {
    const pid = await party({ zoe: "home by nine, under ten bucks" });
    const c = closestFit(pid, "zoe")!;
    // The market is free and ends at 10: only the curfew. The studio ends at 9:30 but costs $18: two rules.
    expect(c).toEqual({ planTitle: "Dolores Night Market", changes: ["stay until 10 PM (you said “home by nine”)"] });
  });

  it("only ever about your own rules, and nothing for someone outside the party", async () => {
    const pid = await party({ zoe: "open to anything, home by nine" });
    const all = JSON.stringify(closestFit(pid, "zoe"));
    for (const id of FIVE.filter((x) => x !== "zoe")) for (const w of privatePhrases(pid, id)) expect(all).not.toContain(w);
    expect(closestFit(pid, "priya")).toBeNull();
  });
});
