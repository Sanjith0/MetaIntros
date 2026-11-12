import type { Frame } from "@/contracts";
import { FIXTURE_FRAMES } from "@/fixtures/demo";

/**
 * The door. A recognition module plugs in here later. Today there is only
 * the interface and a stub.
 *
 * Rules that hold for any implementation:
 *  - It may only answer "which of these gallery members is this, if any".
 *  - The gallery is the viewer's party: people who opted in by joining.
 *  - Nothing is inferred from a face: no age, mood, gender, attractiveness,
 *    or any other attribute. The only output is a member id or null.
 */

export interface GalleryMember {
  userId: string;
}

export interface FrameMatch {
  subjectId: string | null;
}

export interface FrameMatcher {
  readonly name: string;
  match(frame: Frame, gallery: GalleryMember[]): Promise<FrameMatch>;
}

/** Stub matcher: maps a fixture key to a member. It never reads pixels. */
export const stubMatcher: FrameMatcher = {
  name: "stub",
  async match(frame, gallery) {
    const hit = frame.fixtureKey ? FIXTURE_FRAMES[frame.fixtureKey] : undefined;
    if (!hit) return { subjectId: null };
    return { subjectId: gallery.some((g) => g.userId === hit.subjectId) ? hit.subjectId : null };
  },
};

const g = globalThis as unknown as { __pqMatcher?: FrameMatcher };

/** Swap in a real recognition module here. */
export function setMatcher(m: FrameMatcher) {
  g.__pqMatcher = m;
}

export async function matchFrame(frame: Frame, gallery: GalleryMember[]): Promise<FrameMatch> {
  const matcher = g.__pqMatcher ?? stubMatcher;
  const out = await matcher.match(frame, gallery);
  // Defence: whatever plugs in, only a gallery member id (or null) gets through.
  return { subjectId: out.subjectId && gallery.some((m) => m.userId === out.subjectId) ? out.subjectId : null };
}
