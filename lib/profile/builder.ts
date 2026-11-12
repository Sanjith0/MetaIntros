import type { GraphUser } from "@/lib/graph/schema";
import { DAY_INDEX, hhmmToMin } from "@/lib/graph/schema";
import { isSensitiveTag, tagForName, VOCAB_BY_TAG } from "@/lib/graph/vocabulary";
import { embed, TAG_FAMILY } from "./embedding";

/** One grounded fact. `source` points at the Graph field it came from, e.g. "likes[3]". */
export interface SourcedItem {
  name: string;
  tag: string | null;
  category: string;
  source: string;
  sensitive?: boolean;
}

export interface WeightedTag {
  tag: string;
  weight: number;
}

export interface AvailabilityWindow {
  dayOfWeek: number;
  startMin: number;
  endMin: number;
}

export type SocialStyle = "active" | "chill" | "big-crowd" | "small-group";

export interface TasteProfileData {
  userId: string;
  likes: SourcedItem[];
  dislikes: SourcedItem[];
  groups: SourcedItem[];
  music: SourcedItem[];
  eventHistory: SourcedItem[];
  /** Non-sensitive interest tags, weight-desc. Sensitive data is never used for matching. */
  interestTags: WeightedTag[];
  embedding: number[];
  socialStyle: SocialStyle;
  availability: AvailabilityWindow[];
}

const WEIGHT = { likes: 1, groups: 1.5, music: 0.75, events: 2 } as const;

function item(name: string, category: string, source: string): SourcedItem {
  const tag = tagForName(name) ?? null;
  const out: SourcedItem = { name, tag, category, source };
  if (tag && isSensitiveTag(tag)) out.sensitive = true;
  return out;
}

export function inferSocialStyle(tags: WeightedTag[], eventCount: number): SocialStyle {
  const score: Record<SocialStyle, number> = { active: 0, chill: 0, "big-crowd": 0, "small-group": 0 };
  for (const { tag, weight } of tags) {
    const fam = TAG_FAMILY[tag];
    if (fam === "fitness" || fam === "outdoors" || fam === "climb" || fam === "sports") score.active += weight;
    else if (fam === "nightlife") score["big-crowd"] += weight * 1.5;
    else if (fam === "games" || fam === "anime" || fam === "food") score["small-group"] += weight;
    else score.chill += weight;
  }
  if (eventCount >= 4) score["big-crowd"] += 1;
  return (Object.entries(score) as [SocialStyle, number][]).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
}

/** Raw Graph-shaped payload → structured TasteProfile. Pure + deterministic. */
export function buildTasteProfile(g: GraphUser): TasteProfileData {
  const likes = g.likes.data.map((p, i) => item(p.name, p.category, `likes[${i}]`));
  const groups = g.groups.data.map((p, i) => item(p.name, "Group", `groups[${i}]`));
  const music = g.music.data.map((p, i) => item(p.name, p.category, `music[${i}]`));
  const eventHistory = g.events.data.map((p, i) => item(p.name, "Event", `events[${i}]`));
  const dislikes = g.x_not_interested.data.map((p, i) => item(p.name, p.category, `x_not_interested[${i}]`));

  const w = new Map<string, number>();
  const add = (xs: SourcedItem[], k: number) => {
    for (const x of xs) if (x.tag && !x.sensitive) w.set(x.tag, (w.get(x.tag) ?? 0) + k);
  };
  add(likes, WEIGHT.likes);
  add(groups, WEIGHT.groups);
  add(music, WEIGHT.music);
  add(eventHistory, WEIGHT.events);
  // An explicit dislike always wins over an incidental like.
  for (const d of dislikes) if (d.tag) w.delete(d.tag);

  const interestTags = [...w.entries()]
    .map(([tag, weight]) => ({ tag, weight: Math.round(weight * 100) / 100 }))
    .filter((t) => VOCAB_BY_TAG.has(t.tag))
    .sort((a, b) => b.weight - a.weight || a.tag.localeCompare(b.tag));

  return {
    userId: g.id,
    likes,
    dislikes,
    groups,
    music,
    eventHistory,
    interestTags,
    embedding: embed(interestTags),
    socialStyle: inferSocialStyle(interestTags, eventHistory.length),
    availability: g.x_availability.data.map((b) => ({
      dayOfWeek: DAY_INDEX[b.day],
      startMin: hhmmToMin(b.start),
      endMin: hhmmToMin(b.end),
    })),
  };
}

export const dislikeTags = (p: Pick<TasteProfileData, "dislikes">) =>
  new Set(p.dislikes.map((d) => d.tag).filter((t): t is string => Boolean(t)));
