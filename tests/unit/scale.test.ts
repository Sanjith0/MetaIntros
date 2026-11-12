import { describe, expect, it } from "vitest";
import { MAX_GUESTS, runScale } from "@/lib/evals/scale";
import { flag } from "@/lib/flags";
import { resetStore, store } from "@/lib/server/store";

describe("at fair scale (F30)", () => {
  it("is on by default", () => expect(flag("SCALE_TEST")).toBe(true));

  it("100 guests: 20 parties, all locked, every plan valid, nothing leaked, no real calls, and nothing live touched", async () => {
    process.env.PQ_PACE_MS = "0";
    const live = resetStore();
    const before = { version: live.version, parties: live.parties.size, profiles: live.profiles.size, events: live.events_log.length };
    const r = await runScale(100);
    expect(r).toMatchObject({ guests: 100, parties: 20, locked: 20, noMatch: 0, waiting: 0, invalidPlans: 0, leaks: 0, promptLeaks: 0, realCalls: 0, scanned: 100 });
    expect(r.agentTurns).toBeGreaterThanOrEqual(20 * 5 * 2);
    expect(r.matchLagMs.max).toBeLessThan(1000);
    const s = store();
    expect({ version: s.version, parties: s.parties.size, profiles: s.profiles.size, events: s.events_log.length }).toEqual(before);
  });

  it("caps the size", async () => {
    process.env.PQ_PACE_MS = "0";
    expect((await runScale(2)).guests).toBe(5);
    expect(MAX_GUESTS).toBe(300);
  });
});
