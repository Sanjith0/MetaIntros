/**
 * Photos for the seeded content, generated once with Muse's image model (scripts/gen-images.ts; prompts in
 * scripts/image-prompts.ts) and served from public/images. They are content, like avatars: they carry the
 * colour. Anything without a photo (a squad's hangout, an event added later) keeps its colour-and-pattern cover.
 */

/** Seeded events that have a cover photo at /images/covers/<id>.webp (tests/unit/images.test.ts checks the files). */
export const COVER_IDS: ReadonlySet<string> = new Set([
  "ev-indie-guild", "ev-boulder-social", "ev-vinyl-swap", "ev-board-game-night", "ev-ghibli-screening",
  "ev-dnd-oneshot", "ev-run-club", "ev-coffee-crawl", "ev-trail-run", "ev-photo-walk", "ev-baylands-birding",
  "ev-ai-build-night", "ev-founders-coffee", "ev-design-crit", "ev-farmers-market", "ev-ramen-crawl",
  "ev-dumpling-class", "ev-movies-square", "ev-trivia", "ev-karaoke", "ev-edm-night", "ev-warriors-watch",
  "ev-sunset-yoga", "ev-pickleball", "ev-jazz-plaza", "ev-climb-comp", "ev-house-show",
]);

export function eventCoverSrc(eventId: string): string | undefined {
  return COVER_IDS.has(eventId) ? `/images/covers/${eventId}.webp` : undefined;
}
