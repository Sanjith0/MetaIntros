/**
 * Post-confirmation steps, in order. Called directly by the pipeline (no module-level
 * registries: Next.js may instantiate modules per route bundle).
 */
import { createSquadChat } from "./squadChat";
import { postHostWelcome } from "./host";
import { generateTalkCards } from "./talkCards";

export async function afterPartyConfirmed(partyId: string) {
  const steps: [string, (id: string) => Promise<unknown>][] = [
    ["squad chat", createSquadChat],
    ["host welcome", postHostWelcome],
    ["talk cards", generateTalkCards],
  ];
  for (const [name, fn] of steps) {
    try {
      await fn(partyId);
    } catch (e) {
      console.error(`[party ${name}]`, e);
    }
  }
}
