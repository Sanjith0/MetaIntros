import { afterEach, describe, expect, it } from "vitest";
import { DEMO_PARTY as D } from "@/fixtures";
import { runParty } from "@/lib/agents/orchestrator";
import { flag } from "@/lib/flags";
import { joinQueue } from "@/lib/server/queue";
import { resetStore, store } from "@/lib/server/store";
import { stageView } from "@/lib/server/views";
import { takeRecorded } from "@/model/recording";
import { resetModelSettings, setModelSettings, simulatedDelay } from "@/model/settings";

async function party() {
  process.env.PQ_PACE_MS = "0";
  resetStore();
  for (const id of ["dev", "ana", "kai", "zoe", "maya"]) {
    await joinQueue({ userId: id, eventId: D.entryEventId, sentence: D.sentences[id]!, consentBridges: true, startTalk: false });
  }
  const pid = [...store().parties.keys()][0]!;
  await runParty(pid, { paceMs: 0 });
  return pid;
}

afterEach(() => {
  resetModelSettings();
});

describe("real-model readiness (F4)", () => {
  it("is on by default, with every simulation off", () => {
    expect(flag("MODEL_READINESS")).toBe(true);
    expect(resetModelSettings()).toMatchObject({ simulateLatency: false, timeoutAgent: null, source: "live" });
  });

  it("an agent that times out is answered by the fallback, labelled, and the party still locks", async () => {
    setModelSettings({ timeoutAgent: "kai", agentTimeoutMs: 40 });
    const pid = await party();
    const s = store();
    const kai = s.agentCalls.filter((c) => c.ownerId === "kai");
    expect(kai.map((c) => c.source)).toEqual(["fallback", "fallback", "fallback"]);
    expect(kai.every((c) => c.note === "timeout after 40 ms")).toBe(true);
    expect(s.agentCalls.filter((c) => c.ownerId !== "kai").every((c) => c.source === "mock")).toBe(true);
    const kaiTrace = stageView(pid).traces.find((t) => t.actorId === "kai" && t.meta?.kind === "verdicts")!;
    expect(kaiTrace.meta).toMatchObject({ source: "fallback", note: "timeout after 40 ms" });
    expect(s.parties.get(pid)!.planId).toBe(`plan-${D.expectedPlanEventId}`);
    expect(s.receipts.get(`${pid}:kai`)!.fallbackRounds).toEqual([1, 2, 3]);
    expect(s.receipts.get(`${pid}:maya`)!.fallbackRounds).toEqual([]);
  });

  it("streams verdicts in the order agents answer, not member order", async () => {
    setModelSettings({ simulateLatency: true, latencyScale: 0.03 });
    const pid = await party();
    const order = stageView(pid)
      .traces.filter((t) => t.meta?.kind === "verdicts" && t.meta.round === 1)
      .map((t) => t.actorId);
    const expected = ["dev", "ana", "kai", "zoe", "maya"].sort((a, b) => simulatedDelay(`table.round1:${a}`) - simulatedDelay(`table.round1:${b}`));
    expect(order).toEqual(expected);
    expect(store().agentCalls.filter((c) => c.round === 1).every((c) => c.ms >= 10)).toBe(true);
  });

  it("records a run, then replays it labelled as recorded with the same outcome", async () => {
    setModelSettings({ record: true });
    takeRecorded();
    await party();
    expect(Object.keys(takeRecorded())).toHaveLength(30);

    resetModelSettings();
    setModelSettings({ source: "recorded" });
    const pid = await party();
    const s = store();
    expect(s.agentCalls.every((c) => c.source === "recorded")).toBe(true);
    expect(s.agentCalls[0]!.note).toMatch(/^recorded from the mock model/);
    expect(s.parties.get(pid)!.planId).toBe(`plan-${D.expectedPlanEventId}`);
  });
});
