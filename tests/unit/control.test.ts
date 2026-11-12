import { afterEach, describe, expect, it } from "vitest";
import { DEMO_PARTY as D } from "@/fixtures";
import { feasibleFor } from "@/lib/agents/judge";
import { runParty } from "@/lib/agents/orchestrator";
import { briefFor, paceFromEnv } from "@/lib/agents/table";
import { frameSource, setFrameSource } from "@/lib/door/source";
import { flag } from "@/lib/flags";
import { joinQueue } from "@/lib/server/queue";
import { resetStore, store } from "@/lib/server/store";
import { stageView } from "@/lib/server/views";
import { resetModelSettings, setModelSettings } from "@/model/settings";

afterEach(() => {
  resetModelSettings();
  setFrameSource("fixture");
});

async function formed() {
  resetStore();
  for (const id of ["dev", "ana", "kai", "zoe", "maya"]) {
    await joinQueue({ userId: id, eventId: D.entryEventId, sentence: D.sentences[id]!, consentBridges: true, startTalk: false });
  }
  return [...store().parties.keys()][0]!;
}

describe("demo control panel (F5)", () => {
  it("is on by default", () => expect(flag("DEMO_PANEL")).toBe(true));

  it("the pace can be changed at runtime, overriding PQ_PACE_MS", () => {
    process.env.PQ_PACE_MS = "600";
    expect(paceFromEnv()).toBe(600);
    setModelSettings({ paceMs: 0 });
    expect(paceFromEnv()).toBe(0);
  });

  it("Lock now ends a slow talk quickly, with a plan that passes every member's rules", async () => {
    setModelSettings({ paceMs: 400 });
    const pid = await formed();
    const t0 = Date.now();
    const run = runParty(pid);
    await new Promise((r) => setTimeout(r, 300));
    const s = store();
    s.operator.forceLock.add(pid);
    s.operator.fastForward.add(pid);
    await run;
    const elapsed = Date.now() - t0;
    const party = s.parties.get(pid)!;
    expect(party.status).toBe("locked");
    expect(party.lockedBy).toBe("fallback");
    const plan = s.plans.get(party.planId!)!;
    expect(feasibleFor(pid, plan, party.memberIds.map(briefFor))).toBe(true);
    expect(stageView(pid).traces.some((t) => t.title === "Operator locked now")).toBe(true);
    // A normal run at this pace takes well over five seconds.
    expect(elapsed).toBeLessThan(3000);
    // The chat and openers still exist: everything MATCH FOUND needs is ready.
    expect(s.messages.filter((m) => m.chatId === party.chatId && m.kind === "opener")).toHaveLength(5);
  });

  it("the door frame source can be switched to tap only", () => {
    expect(frameSource()).toBe("fixture");
    setFrameSource("tap-only");
    expect(frameSource()).toBe("tap-only");
  });
});
