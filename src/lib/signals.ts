// Deterministic, explainable compatibility signals. The AI reasons over these;
// code uses them to validate the AI and as the fallback.
import type { Profile } from "@/lib/types";

const inter = (a: string[], b: string[]) => a.filter((x) => b.includes(x));

export interface Shared {
  likes: string[];
  groups: string[];
  events: string[];
  friends: string[];
  school: boolean;
  conflicts: string[]; // things one likes that the other dislikes
}

export function shared(a: Profile, b: Profile): Shared {
  return {
    likes: inter(a.likes, b.likes),
    groups: inter(a.groups, b.groups),
    events: inter(a.pastEvents, b.pastEvents),
    friends: inter(a.friends, b.friends),
    school: a.school === b.school,
    conflicts: [...inter(a.dislikes, b.likes), ...inter(b.dislikes, a.likes)],
  };
}

/** First pass: raw taste overlap with the seeker only. */
export function tasteScore(a: Profile, b: Profile) {
  const s = shared(a, b);
  return s.likes.length + s.events.length + s.groups.length * 0.5;
}

/** Pairwise chemistry: taste plus social fit, minus conflicts. */
export function pairScore(a: Profile, b: Profile) {
  const s = shared(a, b);
  let v = s.likes.length + s.groups.length * 0.8 + s.events.length * 1.2 + s.friends.length + (s.school ? 0.8 : 0);
  if (a.vibe === b.vibe) v += 0.6;
  if ((a.vibe === "loud") !== (b.vibe === "loud")) v -= 1;
  v -= s.conflicts.length * 1.5;
  if (Math.abs(a.age - b.age) > 5) v -= 0.5;
  return v;
}

/** Evidence strings the icebreaker model may cite. Format "kind:value". */
export function evidenceList(a: Profile, b: Profile) {
  const s = shared(a, b);
  return [
    ...s.likes.map((x) => `likes:${x}`),
    ...s.groups.map((x) => `group:${x}`),
    ...s.events.map((x) => `event:${x}`),
    ...s.friends.map((x) => `friend:${x}`),
    ...(s.school ? [`school:${a.school}`] : []),
  ];
}

export function hookSummary(a: Profile, b: Profile, max = 2) {
  const s = shared(a, b);
  const bits: string[] = [];
  if (s.events[0]) bits.push(`both at ${s.events[0]}`);
  if (s.friends[0]) bits.push(`mutual friend ${s.friends[0]}`);
  if (s.likes.length) bits.push(s.likes.slice(0, 2).join(" + "));
  if (s.groups[0]) bits.push(s.groups[0]);
  return bits.slice(0, max).join(" · ");
}
