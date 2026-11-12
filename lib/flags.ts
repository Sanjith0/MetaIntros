/**
 * Feature flags. One file, every flag default on.
 * Turn one off on the server with PQ_FLAG_<NAME>=0 (for example PQ_FLAG_STAGE_SCRUBBER=0).
 * Client components get the value from the server page that renders them.
 */

const DEFAULTS = {
  /** F1: /stage live replay with a scrubber, rejections in red, signatures landing. */
  STAGE_SCRUBBER: true,
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
