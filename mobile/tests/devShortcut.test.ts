import { describe, expect, it } from 'vitest';
import { completesDevShortcut, DEV_TOOLS_FROM_PROFILE } from '../src/qu/devShortcut';

describe('Profile tab shortcut to Dev tools', () => {
  it('opens on the sixth quick tap on Profile, and needs six more to open again', () => {
    expect([0, 200, 400, 600, 800].map(t => completesDevShortcut('profile', t))).toEqual([false, false, false, false, false]);
    expect(completesDevShortcut('profile', 1_000)).toBe(true);
    expect(completesDevShortcut('profile', 1_200)).toBe(false);
  });

  it('never opens from another tab', () => {
    const start = 10_000;
    expect(Array.from({ length: 12 }, (_, i) => completesDevShortcut('events', start + i * 100)).some(Boolean)).toBe(false);
  });

  it('does not open on slow taps', () => {
    const start = 20_000;
    expect(Array.from({ length: 8 }, (_, i) => completesDevShortcut('profile', start + i * 1_000)).some(Boolean)).toBe(false);
  });

  it('tells Dev tools it was opened from Profile', () => {
    expect(DEV_TOOLS_FROM_PROFILE).toBe('/glance/dev?from=profile');
  });
});
