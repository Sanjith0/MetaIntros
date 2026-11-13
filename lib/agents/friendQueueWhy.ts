/**
 * Friend Queue Agent: one short line on why a friend's queue might suit you, from shared interest tags and
 * the event's tags only. Visibility is decided by code (lib/match/queueVisibility.ts), never by the model.
 */
import { z } from "zod";
import { runAi } from "@/lib/ai";
import { label } from "./describe";

const Out = z.object({ line: z.string().min(8).max(180) });

export interface WhyInput {
  friendFirstName: string;
  /** shared non-sensitive interest tags, strongest first */
  sharedTags: string[];
  /** null = "any event this weekend" or a new hangout */
  event: { title: string; tags: string[] } | null;
  mode: "events" | "hangout";
}

export function whyTemplate(i: WhyInput): string {
  const shared = i.sharedTags.slice(0, 2).map(label);
  const eventTags = new Set(i.event?.tags ?? []);
  const overlap = i.sharedTags.filter((t) => eventTags.has(t)).map(label)[0];
  const both = shared.length ? `You and ${i.friendFirstName} both like ${shared.join(" and ").toLowerCase()}` : `You and ${i.friendFirstName} are friends`;
  if (i.event && overlap) return `${both}, and ${i.event.title} is all about ${overlap.toLowerCase()}.`;
  if (i.event) return `${both}. Queue for ${i.event.title} too and you'll be matched near each other.`;
  if (i.mode === "hangout") return `${both}. Queue to plan a hangout too and you might end up in the same squad.`;
  return `${both}. Queue for any event too and you'll be matched near each other.`;
}

export async function writeWhy(i: WhyInput) {
  const ai = await runAi({
    task: "friend_queue_why",
    system:
      "You write ONE short, warm sentence (max 25 words) telling a Facebook user why joining their friend's Queue Up queue could be fun, using ONLY the listed shared interests and event. Second person. Don't invent facts. Never reference politics, religion, health or sexuality. No emoji, no exclamation marks. JSON only: {\"line\": \"...\"}.",
    user: JSON.stringify({
      friend: i.friendFirstName,
      sharedInterests: i.sharedTags.slice(0, 5).map(label),
      queue: i.mode === "hangout" ? "planning a new hangout" : i.event ? { event: i.event.title, eventTags: i.event.tags.map(label) } : "any event this weekend",
    }),
    schema: Out,
    fallback: () => ({ line: whyTemplate(i) }),
    maxTokens: 400,
    temperature: 0.6,
    timeoutMs: 8_000,
  });
  return { line: ai.value.line, source: ai.source };
}
