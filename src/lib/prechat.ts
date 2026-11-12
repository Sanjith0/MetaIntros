// Agent pre-chat (P2): each person's agent "talks" to the other's agent using only their
// Facebook profile data, to surface what the two humans would actually enjoy talking about.
// Agents never message humans and never speak as a user.
import { profileById } from "@/data/seed";
import { museEnabled, museJson } from "@/lib/muse";
import { shared } from "@/lib/signals";
import { state } from "@/lib/store";
import type { Profile } from "@/lib/types";

export interface PreChat {
  aId: string;
  bId: string;
  turns: { speaker: "a" | "b"; text: string }[];
  summary: string;
  topics: string[];
  spark: number; // 1..5
  ai: boolean;
}

const vocab = (p: Profile) => [...p.likes, ...p.groups, ...p.pastEvents, p.school, p.work, p.hometown].map((x) => x.toLowerCase());

/** A topic is grounded if it overlaps a real field of either profile. */
export function grounded(topic: string, a: Profile, b: Profile) {
  const t = topic.toLowerCase();
  return [...vocab(a), ...vocab(b)].some((v) => v.includes(t) || t.includes(v));
}

function fallback(a: Profile, b: Profile): PreChat {
  const s = shared(a, b);
  const topics = [...s.events, ...s.likes, ...s.groups].slice(0, 3);
  const t1 = topics[0] ?? b.likes[0];
  const turns: PreChat["turns"] = [
    { speaker: "a", text: `${a.name} is new-ish to Austin and into ${a.likes.slice(0, 2).join(" and ")}. What's ${b.name} like?` },
    { speaker: "b", text: `${b.name}: "${b.bio}" Big on ${b.likes.slice(0, 2).join(" and ")}.` },
    { speaker: "a", text: t1 ? `Overlap on ${t1}. ${a.name} would love to hear ${b.name}'s take.` : `Not much overlap on paper, but similar energy.` },
    { speaker: "b", text: s.conflicts.length ? `Heads up: ${s.conflicts[0]} is a sore spot, so maybe skip it.` : `No clashes. ${a.vibe === b.vibe ? "Same pre-show energy too." : "Slightly different energy, but compatible."}` },
  ];
  const spark = Math.max(1, Math.min(5, Math.round(1 + topics.length + s.friends.length - s.conflicts.length)));
  return { aId: a.id, bId: b.id, turns, topics, spark, summary: topics.length ? `Talk about ${topics.slice(0, 2).join(" and ")}.` : `Ask about ${b.likes[0]}.`, ai: false };
}

interface AiPre {
  turns?: { speaker: string; text: string }[];
  summary?: string;
  topics?: string[];
  spark?: number;
}

export async function preChat(aId: string, bId: string): Promise<PreChat> {
  const cache = ((state() as unknown as { prechat?: Map<string, PreChat> }).prechat ??= new Map());
  const key = `${aId}->${bId}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const a = profileById(aId)!;
  const b = profileById(bId)!;
  let out = fallback(a, b);
  if (museEnabled()) {
    const card = (p: Profile) => ({ name: p.name, age: p.age, bio: p.bio, work: p.work, school: p.school, likes: p.likes, dislikes: p.dislikes, groups: p.groups, pastEvents: p.pastEvents, vibe: p.vibe });
    const r = await museJson<AiPre>({
      model: "ember",
      timeoutMs: 12000,
      maxTokens: 600,
      system:
        "You simulate a short private conversation between two AI agents. Agent A represents person A and agent B represents person B. They compare notes, using ONLY the profile data given, to find what A and B would genuinely enjoy talking about in person and anything to avoid. Agents refer to their humans in the third person and never invent facts. Reply with JSON only.",
      user: JSON.stringify({
        schema: { turns: [{ speaker: "a|b", text: "max 25 words" }], summary: "one sentence for A, max 20 words", topics: ["2-3 short topics, each a word or phrase found in the profiles"], spark: "integer 1-5 predicted conversational chemistry" },
        rules: "4 to 6 turns, alternating, starting with a.",
        a: card(a),
        b: card(b),
      }),
    });
    const turns = (r?.turns ?? [])
      .filter((t) => (t.speaker === "a" || t.speaker === "b") && typeof t.text === "string")
      .slice(0, 6)
      .map((t) => ({ speaker: t.speaker as "a" | "b", text: t.text.slice(0, 220) }));
    const topics = (r?.topics ?? []).filter((t) => typeof t === "string" && grounded(t, a, b)).slice(0, 3);
    if (turns.length >= 3 && topics.length && r?.summary) {
      out = { aId, bId, turns, topics, summary: r.summary, spark: Math.max(1, Math.min(5, Math.round(Number(r.spark) || 3))), ai: true };
    }
  }
  cache.set(key, out);
  return out;
}
