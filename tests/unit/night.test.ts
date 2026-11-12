import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_PARTY as D } from "@/fixtures";
import { feasibleFor } from "@/lib/agents/judge";
import { runParty } from "@/lib/agents/orchestrator";
import { briefFor } from "@/lib/agents/table";
import { flag } from "@/lib/flags";
import { joinQueue, nightPlans, queueStatus } from "@/lib/server/queue";
import { resetStore, store } from "@/lib/server/store";

const join = (id: string, eventId: string, scope: "event" | "night" = "event") =>
  joinQueue({ userId: id, eventId, sentence: D.sentences[id]!, consentBridges: true, scope, startTalk: false });

beforeEach(() => {
  process.env.PQ_PACE_MS = "0";
  resetStore();
});

describe("queue for a whole night (F14)", () => {
  it("is on by default", () => expect(flag("NIGHT_QUEUE")).toBe(true));

  it("a whole-night entry fills a landmark's party, which then plans near that landmark", async () => {
    for (const id of ["dev", "ana", "kai", "zoe"]) await join(id, "evt-rooftop");
    const r = await join("maya", "evt-lake-games", "night"); // she started from an event across the bay
    const party = store().parties.get(r.partyId!)!;
    expect(party.memberIds.sort()).toEqual(["ana", "dev", "kai", "maya", "zoe"]);
    expect(party.candidatePlanIds.every((id) => store().plans.get(id)!.landmark === "Dolores Park")).toBe(true);
  });

  it("five whole-night people pick from every event that evening, anywhere", async () => {
    const starts = ["evt-rooftop", "evt-ggp-walk", "evt-lake-games", "evt-us-lang", "evt-lake-boats"];
    let pid: string | null = null;
    for (const [i, id] of ["dev", "ana", "kai", "zoe", "maya"].entries()) pid = (await join(id, starts[i]!, "night")).partyId ?? pid;
    const party = store().parties.get(pid!)!;
    const plans = party.candidatePlanIds.map((id) => store().plans.get(id)!);
    expect(plans.length).toBe(nightPlans(D.date).length);
    expect(new Set(plans.map((p) => p.landmark)).size).toBeGreaterThanOrEqual(4);
    expect(plans.every((p) => p.date === D.date && Number(p.start.slice(0, 2)) >= 16)).toBe(true);
    expect(plans.some((p) => p.eventId === "evt-ferry-market")).toBe(false); // a 9 AM walk is not tonight
    await runParty(pid!, { paceMs: 0 });
    const locked = store().plans.get(store().parties.get(pid!)!.planId!)!;
    expect(feasibleFor(pid!, locked, party.memberIds.map(briefFor))).toBe(true);
  });

  it("people queued for one place still don't mix with another place", async () => {
    for (const id of ["dev", "ana", "kai", "zoe"]) await join(id, "evt-rooftop");
    const r = await join("maya", "evt-ggp-walk"); // event-scoped, other side of town
    expect(r.partyId).toBeNull();
  });

  it("the queue count for a whole-night entry includes everyone waiting that night", async () => {
    await join("dev", "evt-rooftop");
    await join("ana", "evt-lake-games");
    await join("maya", "evt-ggp-walk", "night");
    expect(queueStatus("maya")!.inBucket).toBe(3);
    expect(queueStatus("dev")!.inBucket).toBe(2); // Dev's own bucket: Dolores Park, plus Maya who can go anywhere
  });
});
