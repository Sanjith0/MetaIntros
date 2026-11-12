import { beforeAll, describe, expect, it } from "vitest";
import { DEMO_PARTY as D } from "@/fixtures";
import { runParty } from "@/lib/agents/orchestrator";
import { flag } from "@/lib/flags";
import { joinQueue } from "@/lib/server/queue";
import { resetStore, store } from "@/lib/server/store";
import { whyThisPlan } from "@/lib/server/why";

let pid = "";
beforeAll(async () => {
  process.env.PQ_PACE_MS = "0";
  resetStore();
  for (const id of ["dev", "ana", "kai", "zoe", "maya"]) {
    await joinQueue({ userId: id, eventId: D.entryEventId, sentence: D.sentences[id]!, consentBridges: true, startTalk: false });
  }
  pid = [...store().parties.keys()][0]!;
  await runParty(pid, { paceMs: 0 });
});

describe("why this plan (F13)", () => {
  it("is on by default", () => expect(flag("WHY_PLAN")).toBe(true));

  it("Maya sees her own three rules checked against the plan's real values", () => {
    const v = whyThisPlan(pid, "maya")!;
    expect(v.planTitle).toBe("Dolores Night Market");
    const mine = v.lines.filter((l) => l.id.startsWith("mine-")).map((l) => l.text);
    expect(mine).toEqual(['Your rule "Done by 11 PM": ends 10 PM', 'Your rule "$20 or less": Free', 'Your rule "No drink minimum": no drink minimum']);
    expect(v.lines.every((l) => l.ok)).toBe(true);
  });

  it("everyone else's rules show only as 'all passed', with no rule ids or words", () => {
    const dev = JSON.stringify(whyThisPlan(pid, "dev"));
    for (const t of ["Done by 11 PM", "No drink minimum", "$20 or less", "hr-maya", "hr-ana", "hr-zoe", "out by eleven"]) expect(dev).not.toContain(t);
    expect(dev).toContain('Your rule \\"$40 or less\\": Free');
    expect(dev).toContain("all passed");
  });

  it("ranks the plan among those that worked for everyone, and says how it was locked", () => {
    const v = whyThisPlan(pid, "kai")!;
    expect(v.lines.find((l) => l.id === "rank")!.text).toBe("Ranked first of the 2 plans that worked for all five, by the group's combined preference");
    expect(v.lines.find((l) => l.id === "unavailable")!.text).toBe("3 other plans were unavailable (no reasons are shared)");
    expect(v.lines.find((l) => l.id === "lock")!.text).toBe("All five signed it");
    // Kai set no rules.
    expect(v.lines.find((l) => l.id === "mine-none")).toBeTruthy();
  });

  it("is only for members of a locked party", () => {
    expect(whyThisPlan(pid, "priya")).toBeNull();
  });
});
