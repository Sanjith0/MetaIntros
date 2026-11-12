import { describe, expect, it } from "vitest";
import type { PQEvent } from "@/contracts";
import { DEMO_PARTY as D } from "@/fixtures";
import { runComparison } from "@/lib/evals/compare";
import { flag } from "@/lib/flags";
import { subscribe } from "@/lib/server/bus";
import { joinQueue } from "@/lib/server/queue";
import { resetStore, store } from "@/lib/server/store";

describe("the leak test four ways (F12)", () => {
  it("is on by default", () => expect(flag("EVALS_PAGE")).toBe(true));

  it("five agents + verifier: no leaks, no exposure, every plan valid; one prompt leaks; the verifier blocks it all; the solver says nothing", async () => {
    process.env.PQ_PACE_MS = "0";
    const c = await runComparison(8);
    const by = Object.fromEntries(c.results.map((r) => [r.id, r]));
    expect(by["five-agents"]).toMatchObject({ leaks: 0, leakingLines: 0, exposure: 0, feasible: 8, simulated: false });
    expect(by["five-agents"]!.pairLines).toBe(8 * 30); // 10 pairs × (1 shared + 2 openers)
    expect(by["one-prompt"]!.simulated).toBe(true);
    expect(by["one-prompt"]!.leakingLines).toBeGreaterThan(0);
    expect(by["one-prompt"]!.exposure).toBe(4);
    expect(by["one-prompt-verifier"]!.leaks).toBe(0);
    expect(by["one-prompt-verifier"]!.blocked).toBe(by["one-prompt-verifier"]!.lines);
    expect(by.solver).toMatchObject({ lines: 0, leaks: 0, feasible: 8 });
  });

  it("runs isolated: a live demo's state is untouched and no live listener hears anything", async () => {
    process.env.PQ_PACE_MS = "0";
    resetStore();
    for (const id of ["dev", "ana", "kai", "zoe"]) {
      await joinQueue({ userId: id, eventId: D.entryEventId, sentence: D.sentences[id]!, consentBridges: true, startTalk: false });
    }
    const before = store();
    const heard: PQEvent[] = [];
    const off = subscribe((e) => heard.push(e));
    await runComparison(3);
    off();
    expect(store()).toBe(before);
    expect(store().queue.filter((q) => q.status === "waiting").map((q) => q.userId).sort()).toEqual(["ana", "dev", "kai", "zoe"]);
    expect(store().parties.size).toBe(0);
    expect(heard).toHaveLength(0);
  });

  it("a live request during a comparison lands in the live store, and nothing is clobbered afterwards", async () => {
    process.env.PQ_PACE_MS = "0";
    resetStore();
    const run = runComparison(6); // not awaited: a live request arrives meanwhile
    await new Promise((r) => setTimeout(r, 5));
    await joinQueue({ userId: "maya", eventId: D.entryEventId, sentence: D.sentences.maya!, consentBridges: true, startTalk: false });
    const live = store();
    expect(live.queue.map((q) => q.userId)).toEqual(["maya"]);
    await run;
    expect(store()).toBe(live);
    expect(store().queue.map((q) => q.userId)).toEqual(["maya"]);
  });
});
