import { describe, expect, it } from "vitest";
import { EVENT_TYPES, PAYLOADS, PlanUnavailablePayload, Profile, EventItem } from "@/contracts";
import { SAMPLE_PAYLOADS } from "@/contracts/samples";
import { DEMO_PARTY, EVENTS, PROFILES } from "@/fixtures";

describe("contracts", () => {
  it("every event type has a payload schema and a valid sample", () => {
    // The 13 from the brief, plus queue.invite (duo queue).
    expect(EVENT_TYPES.length).toBeGreaterThanOrEqual(13);
    for (const t of EVENT_TYPES) expect(PAYLOADS[t].safeParse(SAMPLE_PAYLOADS[t]).success).toBe(true);
  });

  it("plan.unavailable cannot carry a reason", () => {
    const withReason = { ...SAMPLE_PAYLOADS["plan.unavailable"], reason: "two-drink minimum" };
    expect(PlanUnavailablePayload.safeParse(withReason).success).toBe(false);
  });

  it("fixtures satisfy the schemas", () => {
    expect(PROFILES).toHaveLength(40);
    expect(EVENTS).toHaveLength(15);
    for (const p of PROFILES) expect(Profile.safeParse(p).success).toBe(true);
    for (const e of EVENTS) expect(EventItem.safeParse(e).success).toBe(true);
  });

  it("the demo party exists with Maya's exact sentence", () => {
    for (const id of DEMO_PARTY.memberIds) expect(PROFILES.find((p) => p.id === id)).toBeTruthy();
    expect(DEMO_PARTY.sentences.maya).toBe("chill people, out by eleven, under twenty bucks, nowhere I have to drink");
  });
});
