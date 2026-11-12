/* Contract check: every fixture and every event sample must satisfy the
 * Zod contracts, and the privacy-critical shapes must stay strict. */
import { z } from "zod";
import {
  EVENT_TYPES,
  EventItem,
  FriendEdge,
  Group,
  PAYLOADS,
  PQEvent,
  PlanUnavailablePayload,
  Profile,
} from "../contracts";
import { SAMPLE_PAYLOADS } from "../contracts/samples";
import { DEMO_PARTY, EVENTS, FRIENDS, GROUPS, PROFILES } from "../fixtures";
import frame from "../fixtures/frames/dev-at-door.json";
import { Frame } from "../contracts";

let failures = 0;
let checks = 0;
const ok = (cond: boolean, label: string) => {
  checks++;
  if (!cond) {
    failures++;
    console.error(`FAIL ${label}`);
  }
};
const parses = (schema: z.ZodType, value: unknown, label: string) => {
  const r = schema.safeParse(value);
  ok(r.success, `${label}${r.success ? "" : `: ${r.error.issues.map((i) => i.path.join(".") + " " + i.message).join("; ")}`}`);
};

// Fixtures
PROFILES.forEach((p) => parses(Profile, p, `profile ${p.id}`));
EVENTS.forEach((e) => parses(EventItem, e, `event ${e.id}`));
GROUPS.forEach((g) => parses(Group, g, `group ${g.id}`));
FRIENDS.forEach((f, i) => parses(FriendEdge, f, `friend edge ${i}`));
parses(Frame, frame, "fixture frame");

ok(PROFILES.length === 40, `40 profiles (got ${PROFILES.length})`);
ok(new Set(PROFILES.map((p) => p.id)).size === PROFILES.length, "profile ids unique");
ok(EVENTS.length === 15, `15 events (got ${EVENTS.length})`);
const ids = new Set(PROFILES.map((p) => p.id));
FRIENDS.forEach(([a, b]) => ok(ids.has(a) && ids.has(b), `friend edge ${a}-${b} points at real profiles`));
PROFILES.forEach((p) =>
  p.groupIds.forEach((g) => ok(GROUPS.some((x) => x.id === g), `${p.id} group ${g} exists`)),
);
PROFILES.forEach((p) => p.facts.forEach((f) => ok(f.ownerId === p.id, `fact ${f.id} owned by ${p.id}`)));

const lateMinutes = (c: string) => {
  const [h, m] = c.split(":").map(Number) as [number, number];
  return (h < 6 ? h + 24 : h) * 60 + m;
};
const trips = EVENTS.filter((e) => e.drinkMinimum || e.priceUsd > 20 || lateMinutes(e.end) > 23 * 60);
ok(trips.length === 3, `exactly three events trip a rule (got ${trips.length})`);
ok(trips.some((e) => e.drinkMinimum), "one event has a drink minimum");
ok(trips.some((e) => e.priceUsd > 20), "one event costs over $20");
ok(trips.some((e) => lateMinutes(e.end) > 23 * 60), "one event ends after 11 PM");

for (const id of DEMO_PARTY.memberIds) ok(ids.has(id), `demo member ${id} exists`);
ok(
  DEMO_PARTY.sentences.maya === "chill people, out by eleven, under twenty bucks, nowhere I have to drink",
  "Maya's sentence is exact",
);

// Events
const REQUIRED_EVENTS = ["queue.joined", "queue.tick", "party.forming", "agent.verdict", "table.message", "pair.message", "plan.unavailable", "plan.locked", "match.found", "chat.message", "member.arrived", "member.spotted", "runitback.mutual"];
for (const e of REQUIRED_EVENTS) ok((EVENT_TYPES as readonly string[]).includes(e), `event ${e} exists`);
for (const type of EVENT_TYPES) {
  parses(PAYLOADS[type], SAMPLE_PAYLOADS[type], `sample payload ${type}`);
  parses(
    PQEvent,
    {
      id: `e-${type}`,
      seq: 1,
      at: "2026-11-14T19:00:00.000Z",
      type,
      audience: { kind: "users", userIds: ["maya"] },
      stage: true,
      payload: SAMPLE_PAYLOADS[type],
    },
    `envelope ${type}`,
  );
}
ok(
  !PlanUnavailablePayload.safeParse({ ...SAMPLE_PAYLOADS["plan.unavailable"], reason: "drink minimum" }).success,
  "plan.unavailable rejects a reason field",
);
ok(!("reason" in PlanUnavailablePayload.shape), "plan.unavailable has no reason field in its shape");

console.log(`contract:check ${failures === 0 ? "PASS" : "FAIL"} - ${checks - failures}/${checks} checks passed`);
process.exit(failures === 0 ? 0 : 1);
