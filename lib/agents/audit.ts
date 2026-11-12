import { store } from "@/lib/server/store";

/**
 * Context audit. Before an agent's prompt goes to the model, code checks it
 * for every other party member's private words: their sentence, their rule
 * words, and their agents' private reasons so far. The prompt should hold
 * its owner's rules and nobody else's. The result travels with the turn.
 */
export interface ContextAudit {
  chars: number;
  /** How many of the owner's own rule phrases the agent was given (it needs them). */
  own: number;
  /** Any other member's private phrases found in the prompt. Expected empty. */
  others: { ownerId: string; text: string }[];
}

const norm = (s: string) => JSON.stringify(s).slice(1, -1); // how the text appears inside the JSON prompt

export function privatePhrases(partyId: string, ownerId: string): string[] {
  const s = store();
  const brief = s.briefs.get(`brief-${ownerId}`);
  if (!brief) return [];
  const reasons = s.verdicts.filter((v) => v.partyId === partyId && v.ownerId === ownerId && v.decision === "reject").map((v) => v.privateReason);
  return [brief.sentence, ...brief.hardRules.map((r) => r.sourceText), ...reasons].filter((x) => x && x.trim().length >= 6);
}

export function auditContext(prompt: string, partyId: string, ownerId: string): ContextAudit {
  const s = store();
  const party = s.parties.get(partyId);
  const own = (s.briefs.get(`brief-${ownerId}`)?.hardRules ?? []).filter((r) => prompt.includes(norm(r.sourceText))).length;
  const others: ContextAudit["others"] = [];
  const mine = new Set(privatePhrases(partyId, ownerId));
  for (const other of party?.memberIds ?? []) {
    if (other === ownerId) continue;
    for (const text of privatePhrases(partyId, other)) {
      if (mine.has(text)) continue; // two people can type the same words
      if (prompt.includes(norm(text))) others.push({ ownerId: other, text });
    }
  }
  return { chars: prompt.length, own, others };
}

/** The exact prompts, kept for the projector (they hold the owner's private brief). */
export function keepPrompt(partyId: string, ownerId: string, round: number, system: string, user: string) {
  store().prompts.set(`${partyId}:${ownerId}:${round}`, { system, user });
}
