import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_PARTY as D } from "@/fixtures";
import { runParty } from "@/lib/agents/orchestrator";
import { flag } from "@/lib/flags";
import { partyIcs } from "@/lib/server/ics";
import { joinQueue } from "@/lib/server/queue";
import { profile, resetStore, store } from "@/lib/server/store";

const FIVE = ["dev", "ana", "kai", "zoe", "maya"];
async function locked() {
  resetStore();
  for (const id of FIVE) await joinQueue({ userId: id, eventId: D.entryEventId, sentence: D.sentences[id]!, consentBridges: true, startTalk: false });
  const pid = [...store().parties.keys()][0]!;
  await runParty(pid, { paceMs: 0 });
  return pid;
}

describe("add to calendar (F38)", () => {
  beforeEach(() => {
    process.env.PQ_PACE_MS = "0";
  });

  it("is on by default", () => expect(flag("ADD_TO_CALENDAR")).toBe(true));

  it("the locked plan as a valid .ics: local times, place, and nobody's name", async () => {
    const pid = await locked();
    const ics = partyIcs(pid, "maya", new Date("2026-11-12T13:00:00Z"))!;
    expect(ics.filename).toBe("party-queue-dolores-night-market.ics");
    const lines = ics.body.split("\r\n");
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines).toContain("DTSTART;TZID=America/Los_Angeles:20261114T180000");
    expect(lines).toContain("DTEND;TZID=America/Los_Angeles:20261114T220000");
    expect(lines).toContain("SUMMARY:Dolores Night Market");
    expect(lines).toContain("LOCATION:Dolores Park\\, upper lawn\\, Dolores Park");
    expect(lines).toContain("DTSTAMP:20261112T130000Z");
    expect(ics.body.endsWith("END:VCALENDAR\r\n")).toBe(true);
    for (const id of FIVE.filter((x) => x !== "maya")) expect(ics.body).not.toContain(profile(id).firstName);
    expect(partyIcs(pid, "priya")).toBeNull();
  });

  it("a plan that ends after midnight ends the next day", async () => {
    const pid = await locked();
    const s = store();
    const party = s.parties.get(pid)!;
    party.planId = "plan-evt-synth"; // 9 PM to 1 AM
    expect(partyIcs(pid, "maya")!.body).toContain("DTEND;TZID=America/Los_Angeles:20261115T010000");
  });
});
