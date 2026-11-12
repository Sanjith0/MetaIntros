/**
 * Where door frames come from. Set from the demo control panel.
 *  - fixture:  fixture frames (fixtures/frames), matched by the stub. No pixels are read.
 *  - recorded-clip: a recorded sequence of fixture frames, replayed on a timer and labelled as recorded.
 *  - tap-only: the door camera is off; people tap a face instead.
 * Kept on globalThis so a demo reset does not change it.
 */
export type FrameSource = "fixture" | "recorded-clip" | "tap-only";

export const FRAME_SOURCES: { id: FrameSource; label: string }[] = [
  { id: "fixture", label: "Fixture frames (stub matcher, no pixels read)" },
  { id: "recorded-clip", label: "Recorded clip (fixture frames on a timer, no pixels read)" },
  { id: "tap-only", label: "Camera off: tap a face only" },
];

const g = globalThis as unknown as { __pqFrameSource?: FrameSource };

export const frameSource = (): FrameSource => g.__pqFrameSource ?? "fixture";

export function setFrameSource(src: FrameSource) {
  g.__pqFrameSource = src;
}
