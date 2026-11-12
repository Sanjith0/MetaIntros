import type { Person } from "@/lib/profile/load";
import { VOCAB_BY_TAG } from "@/lib/graph/vocabulary";

export const label = (tag: string) => VOCAB_BY_TAG.get(tag)?.label ?? tag;
export const firstName = (p: Pick<Person, "name">) => p.name.split(" ")[0];

/** Privacy-safe profile summary for prompts: only non-sensitive interest tags + style. */
export function publicProfile(p: Person) {
  return {
    id: p.id,
    name: firstName(p),
    topInterests: p.profile.interestTags.slice(0, 6).map((t) => label(t.tag)),
    dislikes: p.profile.dislikes.filter((d) => d.tag && !d.sensitive).map((d) => label(d.tag!)),
    socialStyle: p.profile.socialStyle,
  };
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const fmtWindow = (w: { dayOfWeek: number; startMin: number; endMin: number }) => {
  const t = (m: number) => `${Math.floor(m / 60) % 24 || 12}${m % 60 ? ":" + String(m % 60).padStart(2, "0") : ""}${m >= 720 && m < 1440 ? "pm" : "am"}`;
  return `${DAYS[w.dayOfWeek]} ${t(w.startMin)}–${w.endMin >= 1440 ? "midnight" : t(w.endMin)}`;
};
