import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_PARTY as D } from "@/fixtures";
import { ownerChecks } from "@/lib/agents/judge";
import { runParty } from "@/lib/agents/orchestrator";
import { flag } from "@/lib/flags";
import { planB } from "@/lib/server/planb";
import { joinQueue } from "@/lib/server/queue";
import { resetStore, store } from "@/lib/server/store";

const FIVE = ["dev", "ana", "kai", "zoe", "maya"];
async function run(sentences: Record<string, string> = {}) {
  resetStore();
  for (const id of FIVE) await joinQueue({ userId: id, eventId: D.entryEventId, sentence: sentences[id] ?? D.sentences[id]!, consentBridges: true, startTalk: false });
  const pid = [...store().parties.keys()][0]!;
  await runParty(pid, { paceMs: 0 });
  return pid;
}

describe("plan B (F53)", () => {
  beforeEach(() => {
    process.env.PQ_PACE_MS = "0";
  });

  it("is on by default", () => expect(flag("PLAN_B")).toBe(true));

  it("the demo party's plan B is the clay studio: it fits all five, nobody turned it down, and it's pinned in the chat", async () => {
    const pid = await run();
    const b = planB(pid)!;
    expect(b).toEqual({ planId: "plan-evt-clay", title: "Open Studio: Clay and Tea", when: "7 PM–9:30 PM", venueName: expect.any(String) });
    const s = store();
    const plan = s.plans.get(b.planId)!;
    for (const id of FIVE) expect(ownerChecks(pid, plan, s.briefs.get(`brief-${id}`)!).every((c) => c.pass)).toBe(true);
    const chat = s.messages.filter((m) => m.chatId === s.parties.get(pid)!.chatId);
    expect(chat.some((m) => m.kind === "system" && m.text.startsWith("Plan B, if Dolores Night Market doesn't work out: Open Studio: Clay and Tea · 7 PM–9:30 PM"))).toBe(true);
  });

  it("there's no plan B when nothing else fits everyone, and none before the lock", async () => {
    // Dev's "up to 40" stays; Maya, Ana and Zoe close everything but the market.
    const pid = await run({ zoe: "open to anything, budget around 15", ana: "outdoors if possible, low-key, home by 10" });
    const s = store();
    expect(s.plans.get(s.parties.get(pid)!.planId!)!.title).toBe("Dolores Night Market");
    expect(planB(pid)).toBeNull();
    resetStore();
    for (const id of FIVE) await joinQueue({ userId: id, eventId: D.entryEventId, sentence: D.sentences[id]!, consentBridges: true, startTalk: false });
    expect(planB([...store().parties.keys()][0]!)).toBeNull();
  });
});
