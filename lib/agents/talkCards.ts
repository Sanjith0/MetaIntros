/**
 * Talk Cards Agent: ONE model call per party writes conversation openers for every pair,
 * given only the code-built, source-cited claims. Output is validated and filtered.
 */
import { z } from "zod";
import { runAi } from "@/lib/ai";
import type { Claim } from "@/lib/cards/claims";

const Out = z.object({
  pairs: z.array(z.object({ owner: z.string(), subject: z.string(), openers: z.array(z.string().min(5).max(320)).min(1).max(3) })),
});

export interface PairInput {
  owner: string;
  subject: string;
  subjectFirstName: string;
  claims: Claim[];
}

export async function writeOpeners(pairs: PairInput[], fallback: (p: PairInput) => string[]) {
  const ai = await runAi({
    task: "talk_cards",
    system:
      "You write friendly, specific conversation openers for strangers meeting at an event through Facebook's Queue Up. For each pair, write 2-3 short openers the owner could say to the subject, based ONLY on the listed facts. Don't invent facts. Never reference politics, religion, health or sexuality. JSON only: {\"pairs\": [{\"owner\": \"<id>\", \"subject\": \"<id>\", \"openers\": [\"...\", \"...\"]}]}.",
    user: JSON.stringify({ pairs: pairs.map((p) => ({ owner: p.owner, subject: p.subject, subjectName: p.subjectFirstName, facts: p.claims.map((c) => c.text) })) }),
    schema: Out,
    fallback: () => ({ pairs: pairs.map((p) => ({ owner: p.owner, subject: p.subject, openers: fallback(p) })) }),
    maxTokens: Math.min(2400, 90 * pairs.length + 100),
    temperature: 0.7,
    timeoutMs: 15_000,
  });
  const byKey = new Map(ai.value.pairs.map((p) => [`${p.owner}>${p.subject}`, p.openers]));
  return { openers: (p: PairInput) => byKey.get(`${p.owner}>${p.subject}`) ?? fallback(p), source: ai.source };
}
