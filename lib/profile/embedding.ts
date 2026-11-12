import { hashString, mulberry32 } from "@/lib/rng";

/**
 * Deterministic, offline "interest embedding". Each tag gets a vector that blends a
 * family vector (so climbing≈bouldering, indie≈vinyl) with a tag-specific vector.
 * No model call needed → zero cost, works offline, reproducible in tests.
 */
export const EMBED_DIM = 32;

export const TAG_FAMILY: Record<string, string> = {
  "indie-music": "music", "live-music": "music", vinyl: "music", jazz: "music", karaoke: "music", edm: "nightlife",
  climbing: "climb", bouldering: "climb",
  "board-games": "games", ttrpg: "games", "video-games": "games", trivia: "games", chess: "games",
  anime: "anime", manga: "anime",
  running: "fitness", "run-club": "fitness", marathons: "fitness", cycling: "fitness", yoga: "fitness",
  pickleball: "fitness", basketball: "sports",
  coffee: "coffee",
  hiking: "outdoors", camping: "outdoors", nature: "outdoors", birding: "outdoors", photography: "outdoors",
  startups: "tech", hackathons: "tech", ai: "tech", "tech-talks": "tech", "product-design": "tech",
  food: "food", "farmers-markets": "food", cooking: "food", ramen: "food", baking: "food",
  film: "arts", art: "arts", books: "arts", thrifting: "arts", podcasts: "arts",
  clubbing: "nightlife", "late-nights": "nightlife", "crowded-bars": "nightlife", "loud-venues": "nightlife",
  dogs: "misc", volunteering: "misc", "early-mornings": "misc", "horror-movies": "arts",
};

function randomUnit(seed: string): number[] {
  const rng = mulberry32(hashString(seed));
  const v = Array.from({ length: EMBED_DIM }, () => rng() * 2 - 1);
  return normalize(v);
}

export function normalize(v: number[]): number[] {
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return n === 0 ? v.map(() => 0) : v.map((x) => x / n);
}

const cache = new Map<string, number[]>();
export function tagVector(tag: string): number[] {
  let v = cache.get(tag);
  if (!v) {
    const fam = randomUnit(`family:${TAG_FAMILY[tag] ?? tag}`);
    const own = randomUnit(`tag:${tag}`);
    v = normalize(fam.map((x, i) => 0.65 * x + 0.35 * own[i]));
    cache.set(tag, v);
  }
  return v;
}

export function embed(weights: { tag: string; weight: number }[]): number[] {
  const acc = new Array(EMBED_DIM).fill(0);
  for (const { tag, weight } of weights) {
    const v = tagVector(tag);
    for (let i = 0; i < EMBED_DIM; i++) acc[i] += v[i] * weight;
  }
  return normalize(acc).map((x) => Math.round(x * 1e6) / 1e6);
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na === 0 || nb === 0 ? 0 : dot / Math.sqrt(na * nb);
}
