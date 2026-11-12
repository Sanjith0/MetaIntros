import clip from "@/fixtures/frames/clip-arrivals.json";
import { spotFromFrame } from "@/lib/server/door";
import { nowIso } from "@/lib/server/store";

/**
 * Replay a recorded clip of frames into one viewer's door, on a timer.
 * Every frame is marked source "recorded", so every Spotted from it says
 * method "recorded" and the door and glasses label it as recorded.
 */
const g = globalThis as unknown as { __pqClip?: ReturnType<typeof setTimeout>[] };

export const CLIP = clip;

export function stopClip() {
  for (const t of g.__pqClip ?? []) clearTimeout(t);
  g.__pqClip = [];
}

export function playClip(viewerId: string, partyId: string, opts: { speed?: number } = {}): { frames: number; lengthMs: number } {
  stopClip();
  const speed = opts.speed ?? 1;
  g.__pqClip = clip.frames.map((f, i) =>
    setTimeout(() => {
      void spotFromFrame({
        id: `clip-${Date.now()}-${i}`,
        viewerId,
        partyId,
        capturedAt: nowIso(),
        fixtureKey: f.fixtureKey,
        image: `recorded-clip:${i}`,
        source: "recorded",
      }).catch(() => {});
    }, f.atMs / speed),
  );
  const last = clip.frames.at(-1)?.atMs ?? 0;
  return { frames: clip.frames.length, lengthMs: last / speed };
}
