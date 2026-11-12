/**
 * Feature flags. One file, every flag default on.
 * Turn one off on the server with PQ_FLAG_<NAME>=0 (for example PQ_FLAG_STAGE_SCRUBBER=0).
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
} as const;

export type FlagName = keyof typeof DEFAULTS;

export function flag(name: FlagName): boolean {
  const raw = typeof process !== "undefined" ? process.env?.[`PQ_FLAG_${name}`] : undefined;
  if (raw === "0" || raw === "false" || raw === "off") return false;
  if (raw === "1" || raw === "true" || raw === "on") return true;
  return DEFAULTS[name];
}

export function allFlags(): Record<FlagName, boolean> {
  return Object.fromEntries((Object.keys(DEFAULTS) as FlagName[]).map((k) => [k, flag(k)])) as Record<FlagName, boolean>;
}
