import { DEMO_DATE, DEMO_LANDMARK } from "./events";

/** The demo party and the one sentence each person types. */
export const DEMO_PARTY = {
  memberIds: ["maya", "dev", "ana", "kai", "zoe"] as const,
  landmark: DEMO_LANDMARK,
  date: DEMO_DATE,
  /** The event Maya taps "Find my party" on. */
  entryEventId: "evt-rooftop",
  window: { start: `${DEMO_DATE}T18:00:00-08:00`, end: `${DEMO_DATE}T23:59:00-08:00` },
  sentences: {
    maya: "chill people, out by eleven, under twenty bucks, nowhere I have to drink",
    dev: "something with music, I'm fine spending up to 40, want to try something new",
    ana: "outdoors if possible, low-key, home by midnight",
    kai: "games or something hands-on, nothing too loud",
    zoe: "open to anything, just want to meet people, budget around 25",
  } as Record<string, string>,
  /** What the demo expects code to lock. */
  expectedPlanEventId: "evt-night-market",
  rooftopEventId: "evt-rooftop",
} as const;

/** Door-camera fixture frames. The stub maps a fixture key to a party
 *  member who opted in to the door gallery. It never reads pixels. */
export const FIXTURE_FRAMES: Record<string, { subjectId: string }> = {
  "door-frame-dev": { subjectId: "dev" },
  "door-frame-ana": { subjectId: "ana" },
  "door-frame-kai": { subjectId: "kai" },
  "door-frame-zoe": { subjectId: "zoe" },
  "door-frame-maya": { subjectId: "maya" },
};
