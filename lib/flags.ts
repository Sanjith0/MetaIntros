/**
 * Feature flags. One file. Every flag is on by default except VOICE_SENTENCE.
 * Turn one off on the server with PQ_FLAG_<NAME>=0 (or on with =1), or at runtime from
 * /demo (a runtime override wins over the environment until the server restarts).
 * Client components get the value from the server page that renders them.
 */

const DEFAULTS = {
  /** F1: /stage live replay with a scrubber, rejections in red, signatures landing. */
  STAGE_SCRUBBER: true,
  /** F2: on your own phone, your private rules and receipt next to a computed "what the party knows" column. */
  SECRET_PANEL: true,
  /** F3: real phones on the local network: QR join links, presence, server-clock acks, vibration. */
  REAL_PHONES: true,
  /** F4: verdicts streamed as each agent returns, per-agent latency, labelled fallbacks and recorded replays. */
  MODEL_READINESS: true,
  /** F5: /demo control panel: reset, pre-queue four, lock now, frame source, model behaviour, pace. */
  DEMO_PANEL: true,
  /** F6: queue with a friend (duo), and women-only / not-the-only-woman settings in the queue sheet. */
  DUO_QUEUE: true,
  /** F7: bridge lines say a tie exists without naming a third person who never opted in. */
  BRIDGE_PRIVACY: true,
  /** F8: chat lifecycle: I'm here pings, leaving before the lock without attribution, expiry after the event. */
  CHAT_LIFECYCLE: true,
  /** F9: a glasses (heads-up) view on the same Spotted contract, and a recorded-clip frame source labelled as recorded. */
  GLASSES_VIEW: true,
  /** F10: run it back: a two-person chat per mutual pair, the same "queue again" card for everyone without a match, standing parties. */
  RUN_IT_BACK_PLUS: true,
  /** F11: /fair/host dashboard with live counts (guests, queued, parties formed, locked, met). Counts only. */
  FAIR_HOST: true,
  /** F12: /evals: the leak test four ways (one prompt, one prompt + verifier, five agents + verifier, solver). */
  EVALS_PAGE: true,
  /** F13: a "why this plan" card on /party built only from code checks. */
  WHY_PLAN: true,
  /** F14: queue for a whole night: join any landmark's queue that evening; a whole-night party picks from every event that night. */
  NIGHT_QUEUE: true,
  /** F15: /safety: what code enforces, block and unblock, leave, and report (the reported person is never told). */
  SAFETY_PAGE: true,
  /** F16: say your sentence instead of typing it (typing always works). OFF by default: browser speech recognition may send audio to the browser vendor's service. */
  VOICE_SENTENCE: false,
  /** F17: skip link, MATCH FOUND focus and Escape, chat send retry. (Contrast and labels are always on.) */
  UX_STATES: true,
  /** F18: /how: the architecture diagram and the guarantees, for judges. */
  HOW_PAGE: true,
  /** F19: every agent prompt is audited by code for other members' private words; the stage shows it per turn. */
  CONTEXT_AUDIT: true,
  /** F20: "Try to leak it" on the stage: type a line as any agent and watch the verifier stop it. */
  LEAK_TEST: true,
  /** F21: "What if" on the stage: re-run the table in a sandbox without one member's rule. */
  WHAT_IF: true,
  /** F22: when no plan fits all five, everyone goes back to the front of the queue, nobody is blamed, and the same five never re-form. */
  NO_MATCH: true,
  /** F23: "Why this?" under every card and opener: the approved facts it was written from, in plain words. */
  WHY_LINE: true,
  /** F24: "Forget my night" on /safety: delete your private data from a party, then a scan of the whole server store proves it's gone. */
  FORGET_ME: true,
  /** F25: preflight on /demo: rehearse the whole demo party in a sandbox and check everything the presenter needs. */
  PREFLIGHT: true,
  /** F26: a standing party (3+ who all picked each other) queues together again; code keeps them together and fills the party with new people. */
  STANDING_QUEUE: true,
  /** F27: a "rogue model" switch on /demo: every agent accepts everything and tries to say its person's rules; code still holds. */
  ROGUE_MODE: true,
  /** F28: the projector lists every party (place, night, status) and can pin one; by default it follows new parties. */
  STAGE_PARTIES: true,
  /** F29: /how as a proof hub: every guarantee links to where it can be seen working, and names its test. */
  PROOF_HUB: true,
  /** F30: /evals runs a whole fair (100 fictional guests) through the real loop in a sandbox and reports timing, validity and leaks. */
  SCALE_TEST: true,
  /** F31: "How your agent did it" in your receipt: a private, round-by-round story of your own agent's moves. */
  AGENT_STORY: true,
  /** F32: "Why this?" in the group chat too, under each suggested opener and the pinned plan. */
  CHAT_WHY: true,
  /** F33: a big caption on /stage saying what just happened, in plain words, for the back of the room. */
  STAGE_CAPTIONS: true,
  /** F34: change your sentence while you wait in the queue, and keep your place in line. */
  EDIT_SENTENCE: true,
  /** F35: a run of show on /demo: nine timed beats to 5:00, what to say, where to show it, one-click setup. */
  RUN_OF_SHOW: true,
  /** F36: "Tell a friend where you'll be": a message for someone outside the app with the plan and when you'll check in. Never names the others. */
  TELL_A_FRIEND: true,
  /** F37: find each other at the venue: "running late" and "where we meet", on everyone's door screen and in the chat. */
  FIND_EACH_OTHER: true,
  /** F38: "Add to calendar" on /party: the locked plan as an .ics file, local times, names nobody. */
  ADD_TO_CALENDAR: true,
  /** F39: your agent remembers, with your OK: after the night, how the plan was for you becomes a preference it suggests next time. About plans, never people. */
  AGENT_MEMORY: true,
  /** F40: /me, "Your data": everything Party Queue holds about you, for you only, with where to change it and a JSON download. */
  MY_DATA: true,
  /** F41: public screen mode for /stage: what the room may see (plans, a signature count, code events, captions without names). No reasons, no names, no lines. */
  PUBLIC_SCREEN: true,
  /** F42: "Can't make it" after the lock: the seat is refilled from the queue by someone whose own rules pass the plan; nobody is told who left. */
  SEAT_REFILL: true,
  /** F43: private data from a night is deleted automatically when the party chat closes, unless you choose to keep it. */
  AUTO_FORGET: true,
  /** F44: bring up to three friends: you all land in one party, with new people; each types their own sentence. */
  FRIEND_GROUP: true,
  /** F45: when nothing there fits your own rules, the smallest change that would open a plan, told only to you. */
  CLOSEST_FIT: true,
  /** F46: follow along: /stage?screen=public is enforced on the server (anonymous seats, no words) and the projector shows a QR to it. */
  FOLLOW_ALONG: true,
  /** F47: presenter keys on /stage: Space play/pause, arrows step, L live, P public screen, C captions, 1/2/4 speed, ? help. */
  STAGE_KEYS: true,
  /** F48: the lock as a moment on the projector: a MATCH FOUND splash, with how fast the phones showed it when they report. */
  LOCK_SPLASH: true,
  /** F49: while waiting near one place with too few people, widen to anywhere tonight in one tap and keep your place. */
  WIDEN_SEARCH: true,
} as const satisfies Record<string, boolean>;

export type FlagName = keyof typeof DEFAULTS;

const g = globalThis as unknown as { __pqFlagOverrides?: Partial<Record<FlagName, boolean>> };

export function setFlagOverride(name: FlagName, value: boolean | null) {
  const o = (g.__pqFlagOverrides ??= {});
  if (value === null) delete o[name];
  else o[name] = value;
}

export function flag(name: FlagName): boolean {
  const override = g.__pqFlagOverrides?.[name];
  if (typeof override === "boolean") return override;
  const raw = typeof process !== "undefined" ? process.env?.[`PQ_FLAG_${name}`] : undefined;
  if (raw === "0" || raw === "false" || raw === "off") return false;
  if (raw === "1" || raw === "true" || raw === "on") return true;
  return DEFAULTS[name];
}

export const FLAG_NAMES = Object.keys(DEFAULTS) as FlagName[];
export const flagDefault = (name: FlagName): boolean => DEFAULTS[name];

export function allFlags(): Record<FlagName, boolean> {
  return Object.fromEntries((Object.keys(DEFAULTS) as FlagName[]).map((k) => [k, flag(k)])) as Record<FlagName, boolean>;
}
