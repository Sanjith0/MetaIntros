import { TapCounter } from '../secretTaps';

/**
 * Hidden shortcut: six quick taps on Link's Profile tab open Glance's Dev tools (every face scan).
 * `from=profile` tells that page its back arrow returns to Profile, not into Glance.
 */
export const DEV_TOOLS_FROM_PROFILE = '/glance/dev?from=profile';

// One counter for the whole app: every screen draws its own tab bar, and the first tap changes screen.
const taps = new TapCounter();

/** Call on every tab press. True on the press that completes six quick taps on Profile. */
export function completesDevShortcut(tab: string, now: number): boolean {
  return tab === 'profile' && taps.tap(now);
}
