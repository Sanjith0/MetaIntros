import { beforeEach, describe, expect, it } from "vitest";
import fc from "fast-check";
import EVENTS from "@/data/seed/events.json";
import { mockProvider } from "@/lib/ai";
import { eventSelectionAgent } from "@/lib/agents/eventSelection";
import { groupCohesion } from "@/lib/match/cohesion";
import { coversRange } from "@/lib/match/availability";
import type { Candidate } from "@/lib/match/engine";
import { groupContext } from "@/lib/server/pipeline";
import { eventTimes } from "@/lib/seed/seed";
import { dislikeTags } from "@/lib/profile/builder";
import { loadPeopleFromFiles } from "../helpers/people";

const NOW = new Date(2026, 10, 12, 9);
const people = loadPeopleFromFiles();
const events = EVENTS.map((e) => ({ ...e, ...eventTimes(NOW, e.dayOffset, e.start, e.durationMin), isPublicVenue: (e as { isPublicVenue?: boolean }).isPublicVenue ?? true }))
  .filter((e) => e.dayOffset >= 0 && e.dayOffset <= 2);
const center = { lat: 37.4443, lng: -122.1611 };

function ctx(ids: string[]) {
  const members = ids.map((i) => people.get(i)!);
  const cand: Candidate = { entryIds: ids, userIds: ids, eventId: null, cohesion: groupCohesion(members) };
  return { members, cand, group: groupContext(members, cand, center) };
}
const indie = ["p01", "p03", "p05", "p11", "p12", "p14"];

describe("Event Selection Agent", () => {
  beforeEach(() => mockProvider().reset());

  it("'anything this weekend': follows a valid model pick with runner-ups and reasons", async () => {
    const { cand, group } = ctx(indie);
    mockProvider().on("event_selection", (req) => {
      const opts = JSON.parse(req.messages[1].content).options as { id: string }[];
      return JSON.stringify({ choice: opts[1].id, runnersUp: [opts[0].id, opts[2]?.id].filter(Boolean), reasons: ["Great for a squad of climbers"] });
    });
    const r = (await eventSelectionAgent({ queuedEventId: null, events, group, cand, now: NOW }))!;
    expect(r.source).toBe("mock");
    expect(r.runnersUp.length).toBeGreaterThanOrEqual(1);
    expect(r.reasons[0]).toMatch(/climbers/);
    expect(r.steps.map((s) => s.toolName).filter(Boolean)).toEqual(["listEvents", "checkEventFit"]);
  });

  it("rejects a pick outside the shared availability window", async () => {
    const { cand, group } = ctx(indie);
    // indie crowd isn't free Sunday 7:30am → the sunrise trail run is out of window
    expect(coversRange(group.sharedWindows, events.find((e) => e.id === "ev-trail-run")!.startsAt, events.find((e) => e.id === "ev-trail-run")!.endsAt)).toBe(false);
    mockProvider().on("event_selection", () => JSON.stringify({ choice: "ev-trail-run", runnersUp: [], reasons: ["Sunrise!"] }));
    const r = (await eventSelectionAgent({ queuedEventId: null, events, group, cand, now: NOW }))!;
    expect(r.eventId).not.toBe("ev-trail-run");
    expect(r.steps.find((s) => s.kind === "safety_check")!.summary).toMatch(/outside the group's shared free time/);
  });

  it("rejects a pick that matches a member's dislike, and private venues", async () => {
    const { cand, group } = ctx(indie);
    expect([...group.dislikes.keys()]).toEqual(expect.arrayContaining(["edm"]));
    for (const bad of ["ev-edm-night", "ev-house-show"]) {
      mockProvider().on("event_selection", () => JSON.stringify({ choice: bad, runnersUp: [bad], reasons: ["x"] }));
      const r = (await eventSelectionAgent({ queuedEventId: null, events, group, cand, now: NOW }))!;
      expect(r.eventId).not.toBe(bad);
      expect(r.runnersUp).not.toContain(bad);
    }
  });

  it("property: whatever the model says, the final pick is in-window, public and dislike-free", async () => {
    const ids = events.map((e) => e.id);
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...ids, "made-up"), fc.uniqueArray(fc.constantFrom(...Array.from(people.keys())), { minLength: 3, maxLength: 6 }), async (choice, members) => {
        const { cand, group } = ctx(members);
        mockProvider().on("event_selection", () => JSON.stringify({ choice, runnersUp: ids.slice(0, 2), reasons: ["because"] }));
        const r = await eventSelectionAgent({ queuedEventId: null, events, group, cand, now: NOW });
        if (!r) return; // no event fits everyone → party is not formed
        const ev = events.find((e) => e.id === r.eventId)!;
        expect(ev.isPublicVenue).toBe(true);
        expect(coversRange(group.sharedWindows, ev.startsAt, ev.endsAt)).toBe(true);
        const dis = new Set(members.flatMap((m) => [...dislikeTags(people.get(m)!.profile)]));
        expect(ev.tags.some((t) => dis.has(t))).toBe(false);
        for (const id of r.runnersUp) expect(events.find((e) => e.id === id)!.isPublicVenue).toBe(true);
      }),
      { numRuns: 60 },
    );
  });

  it("specific-event queue: validates fit in code with no model call", async () => {
    const { cand, group } = ctx(indie);
    const r = (await eventSelectionAgent({ queuedEventId: "ev-indie-guild", events, group, cand: { ...cand, eventId: "ev-indie-guild" }, now: NOW }))!;
    expect(r.eventId).toBe("ev-indie-guild");
    expect(r.reasons[0]).toMatch(/queued/);
    expect(mockProvider().calls).toHaveLength(0);
  });
});
