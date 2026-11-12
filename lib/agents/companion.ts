/**
 * Companion pre-chats: each user's companion agent "talks" to another member's companion,
 * seeing ONLY those two (privacy-filtered) profiles, to surface conversation sparks.
 * Outputs are always stored and shown as AI simulations, never as real messages.
 * Model calls only for pairs that include a real (non-simulated) person.
 */
import { z } from "zod";
import { runAi } from "@/lib/ai";
import { isSensitiveText } from "@/lib/cards/claims";
import type { Person } from "@/lib/profile/load";
import { label, publicProfile } from "./describe";

const Out = z.object({
  transcript: z.array(z.object({ speaker: z.enum(["A", "B"]), text: z.string().min(2).max(240) })).min(2).max(8),
  sparks: z.array(z.string().min(5).max(160)).min(1).max(3),
});
export type PreChatOut = z.infer<typeof Out>;

export function sharedTags(a: Person, b: Person) {
  const bt = new Set(b.profile.interestTags.map((t) => t.tag));
  return a.profile.interestTags.filter((t) => bt.has(t.tag)).map((t) => t.tag);
}

export function templatePreChat(a: Person, b: Person): PreChatOut {
  const s = sharedTags(a, b).map((t) => label(t).toLowerCase());
  const an = a.name.split(" ")[0], bn = b.name.split(" ")[0];
  const top = s[0] ?? "weekend plans";
  return {
    transcript: [
      { speaker: "A", text: `${an}'s been really into ${top} lately.` },
      { speaker: "B", text: `Same with ${bn}! ${s[1] ? `Also big on ${s[1]}.` : "Always looking for new spots."}` },
      { speaker: "A", text: `Then they should swap favorite ${top} spots tonight.` },
      { speaker: "B", text: "Agreed — easy opener." },
    ],
    sparks: [s[1] ? `Both into ${top} and ${s[1]}` : `Both into ${top}`],
  };
}

export async function runPreChat(a: Person, b: Person, useModel: boolean) {
  const fallback = () => templatePreChat(a, b);
  if (!useModel) return { value: fallback(), source: "template" as const };
  const ai = await runAi({
    task: "companion_prechat",
    system:
      "You simulate two AI companions (A and B) briefly chatting on behalf of their humans, who will meet at an event. Use ONLY the two profiles given. Write a 4-6 line playful exchange that discovers the strongest conversation sparks, then list 1-3 sparks. Never mention politics, religion, health or sexuality. JSON only: {\"transcript\": [{\"speaker\": \"A\"|\"B\", \"text\": \"...\"}], \"sparks\": [\"...\"]}.",
    user: JSON.stringify({ A: publicProfile(a), B: publicProfile(b), shared: sharedTags(a, b).map(label) }),
    schema: Out,
    fallback,
    maxTokens: 320,
    temperature: 0.8,
  });
  const v = ai.value;
  const clean = [...v.transcript.map((t) => t.text), ...v.sparks].some(isSensitiveText) ? fallback() : v;
  return { value: clean, source: clean === v ? ai.source : ("fallback" as const) };
}
