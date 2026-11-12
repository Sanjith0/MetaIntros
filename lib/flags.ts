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
