import type { Brief } from "@/contracts";
import { PREFS } from "@/lib/agents/brief";
import { flag } from "@/lib/flags";
import { store } from "./store";

/**
 * Your agent remembers, with your OK (F39). After the night you say,
 * privately, how the plan was for you. That suggests preferences for next
 * time ("likes outdoors", "prefers quiet"), and only the ones you tick are
 * kept. They're about plans, never about people; they're only ever
 * preferences, never hard rules; you see them in your next private preview
 * and can leave them out or make your agent forget.
 */
export type Feeling = "loved" | "loud" | "meh";
export interface Remembered {
  tag: string;
  weight: number;
  from: string;
}

const VOCAB = new Set(PREFS.map((p) => p.tag).filter((t) => t !== "open"));
export const LABEL: Record<string, string> = {
  chill: "likes low-key",
  quiet: "prefers quiet",
  music: "likes live music",
  outdoors: "likes being outside",
  games: "likes games",
  "hands-on": "likes making things",
  new: "likes trying new things",
  social: "likes meeting people",
  food: "likes good food",
};

function lockedPlan(partyId: string, userId: string) {
  const s = store();
  const party = s.parties.get(partyId);
  if (!party || party.status !== "locked" || !party.planId || !party.memberIds.includes(userId)) return null;
  return s.plans.get(party.planId) ?? null;
}

/** What a feeling suggests remembering, from this plan. */
export function suggestions(partyId: string, userId: string, feeling: Feeling): Remembered[] {
  const plan = lockedPlan(partyId, userId);
  if (!plan) return [];
  if (feeling === "loud") return [{ tag: "quiet", weight: 2, from: plan.title }];
  if (feeling === "loved") return plan.tags.filter((t) => VOCAB.has(t)).map((tag) => ({ tag, weight: 1, from: plan.title }));
  return [];
}

export function remember(partyId: string, userId: string, feeling: Feeling, tags: string[]): Remembered[] {
  if (!flag("AGENT_MEMORY")) throw new Error("turned off");
  const offered = suggestions(partyId, userId, feeling);
  if (!lockedPlan(partyId, userId)) throw new Error("Only after your plan is set.");
  const keep = offered.filter((o) => tags.includes(o.tag));
  const s = store();
  const mine = (s.memory.get(userId) ?? []).filter((m) => !keep.some((k) => k.tag === m.tag));
  s.memory.set(userId, [...mine, ...keep]);
  return memoryOf(userId);
}

export const memoryOf = (userId: string): Remembered[] => [...(store().memory.get(userId) ?? [])];

export function forgetMemory(userId: string) {
  store().memory.delete(userId);
}

/** At join: add what your agent remembers to your brief's preferences (never rules), unless you left it out. */
export function withMemory(brief: Brief, userId: string): Brief {
  if (!flag("AGENT_MEMORY")) return brief;
  const extra = memoryOf(userId).filter((m) => !brief.preferences.some((p) => p.tag === m.tag));
  if (!extra.length) return brief;
  return {
    ...brief,
    preferences: [...brief.preferences, ...extra.map((m) => ({ id: `pref-${userId}-mem-${m.tag}`, tag: m.tag, weight: m.weight, sourceText: `remembered from ${m.from}` }))],
  };
}
