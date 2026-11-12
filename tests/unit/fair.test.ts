import { beforeEach, describe, expect, it } from "vitest";
import { runParty } from "@/lib/agents/orchestrator";
import { flag } from "@/lib/flags";
import { fairStats, simulateArrivals, simulateGuests } from "@/lib/server/fair";
import { resetStore, store } from "@/lib/server/store";

beforeEach(() => {
  process.env.PQ_PACE_MS = "0";
  resetStore();
});

const settle = () => Promise.all([...store().parties.keys()].map((id) => runParty(id, { paceMs: 0 })));

describe("fair host (F11)", () => {
  it("is on by default", () => expect(flag("FAIR_HOST")).toBe(true));

  it("ten guests make two parties; arrivals count as met", async () => {
    await simulateGuests(10);
    expect(fairStats()).toMatchObject({ guests: 10, parties: 2, queued: 0 });
    await settle();
    expect(fairStats().locked).toBe(2);
    expect(simulateArrivals()).toBe(10);
    expect(fairStats()).toMatchObject({ met: 10, partiesMet: 2 });
  });

  it("seven guests: one party of five and two still waiting", async () => {
    await simulateGuests(7);
    expect(fairStats()).toMatchObject({ guests: 7, parties: 1, queued: 2 });
  });

  it("the host sees counts only: no names, ids or sentences", async () => {
    await simulateGuests(10);
    await settle();
    const s = fairStats();
    expect(Object.values(s).every((v) => typeof v === "number")).toBe(true);
    expect(Object.keys(s).sort()).toEqual(["guests", "locked", "met", "parties", "partiesMet", "queued"]);
  });
});
