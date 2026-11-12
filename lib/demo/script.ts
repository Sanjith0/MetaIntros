/**
 * The run of show for the five-minute demo (F35): each beat's time slot,
 * the one line to say, where to show it, and one-click setup. A unit test
 * keeps the beats back to back from 0:00 to 5:00 and every link and action
 * pointing at something real.
 */
export interface Call {
  url: string;
  body?: unknown;
  method?: "POST" | "DELETE";
}
export interface Beat {
  id: string;
  /** Seconds from the start. */
  at: number;
  end: number;
  title: string;
  say: string;
  show: { label: string; href: string }[];
  actions: { label: string; calls: Call[] }[];
}

export const DEMO_SECONDS = 300;

export const BEATS: Beat[] = [
  {
    id: "setup",
    at: 0,
    end: 20,
    title: "Set up",
    say: "Five strangers want the same night out. Four are already in the queue.",
    show: [{ label: "the projector", href: "/stage" }],
    actions: [
      { label: "Reset everything", calls: [{ url: "/api/demo/reset" }] },
      { label: "Pre-queue Dev, Ana, Kai, Zoe", calls: [{ url: "/api/demo/start", body: { mode: "four" } }] },
    ],
  },
  {
    id: "sentence",
    at: 20,
    end: 60,
    title: "One sentence",
    say: "Maya types one sentence. Her rules become a private brief that never leaves her phone.",
    show: [{ label: "the event", href: "/event/evt-rooftop" }],
    actions: [{ label: "View as Maya", calls: [{ url: "/api/viewer", body: { id: "maya" } }] }],
  },
  {
    id: "table",
    at: 60,
    end: 120,
    title: "The table",
    say: "Five agents, each seeing only its own person. A broken rule reaches the others only as “unavailable”. The caption says what just happened.",
    show: [{ label: "the projector", href: "/stage" }],
    actions: [],
  },
  {
    id: "match",
    at: 120,
    end: 140,
    title: "MATCH FOUND",
    say: "Code locks the plan, and all five phones light up within milliseconds.",
    show: [{ label: "the five phones", href: "/phones" }],
    actions: [],
  },
  {
    id: "secret",
    at: 140,
    end: 170,
    title: "Maya's secret",
    say: "Her rules, on her phone. What the party knows: nothing, computed by scanning everything the other four can load.",
    show: [{ label: "Maya's party", href: "/party" }],
    actions: [],
  },
  {
    id: "break",
    at: 170,
    end: 210,
    title: "Try to break it",
    say: "Type a leak as any agent: blocked. Make every agent misbehave: code still locks a plan that passes everyone's rules.",
    show: [{ label: "the projector", href: "/stage" }],
    actions: [
      { label: "Rogue model on, rerun the party", calls: [{ url: "/api/demo/settings", body: { rogue: true } }, { url: "/api/demo/start", body: { mode: "all" } }] },
      { label: "Rogue model off", calls: [{ url: "/api/demo/settings", body: { rogue: false } }] },
    ],
  },
  {
    id: "door",
    at: 210,
    end: 240,
    title: "At the door",
    say: "Who's in front of you and what to say. Tap “Why this?” for the approved facts behind it. Nothing comes from a face.",
    show: [{ label: "the door", href: "/door" }],
    actions: [{ label: "Dev arrives", calls: [{ url: "/api/demo/frame", body: { subjectId: "dev", viewerId: "maya" } }] }],
  },
  {
    id: "after",
    at: 240,
    end: 275,
    title: "After",
    say: "Private picks; only mutual ones are revealed. Three who all picked each other can queue again, together.",
    show: [{ label: "Run it back", href: "/runitback" }],
    actions: [],
  },
  {
    id: "proof",
    at: 275,
    end: 300,
    title: "Check us",
    say: "Every claim, with a link to see it working and the test that proves it.",
    show: [{ label: "How it works", href: "/how" }],
    actions: [],
  },
];

export const mmss = (sec: number) => `${Math.floor(Math.max(0, sec) / 60)}:${String(Math.floor(Math.max(0, sec) % 60)).padStart(2, "0")}`;

/** The beat for this moment (the last one once time is up). */
export function beatAt(sec: number): Beat {
  return BEATS.find((b) => sec >= b.at && sec < b.end) ?? BEATS[BEATS.length - 1]!;
}
