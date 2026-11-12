import { flag } from "@/lib/flags";
import { factById, profile, store } from "./store";
import { logConsent } from "./consent";

/**
 * Take back what you shared (F57). Approving a fact isn't forever: you can
 * stop sharing it. Code then rewrites everything built from it, in every
 * party: cards lose the shared line and the opener (a plain greeting stands
 * in, built from nothing about anyone), and chat openers, pair lines and
 * table lines say they were removed at the person's request. Your approved
 * line built from it is withdrawn, so no agent can use it again.
 */
export const REMOVED = "Removed at their request.";
export const GREETING = "Say hi, and ask how their night is going.";
export const removedId = (factId: string) => `removed-${factId}`;

export interface RevokeResult {
  factId: string;
  rewritten: { cards: number; messages: number; pairs: number; table: number };
}

export const sharedFacts = (userId: string) => profile(userId).facts.filter((f) => f.approved);

export function revokeFact(userId: string, factId: string): RevokeResult {
  if (!flag("REVOKE_SHARING")) throw new Error("turned off");
  const f = factById(factId);
  if (!f || f.ownerId !== userId) throw new Error("That isn't one of your facts.");
  if (!f.approved) throw new Error("You already stopped sharing that.");
  f.approved = false;
  logConsent(userId, `Stopped sharing “${f.tag}”; everything built from it was rewritten.`, "withdrew");
  const s = store();

  // Lines in your brief built from it are withdrawn; remember them to find table lines.
  const lineIds = new Set<string>();
  for (const b of s.briefs.values()) {
    if (b.ownerId !== userId) continue;
    for (const l of b.shareable) {
      if (l.factIds.includes(factId)) {
        l.approved = false;
        lineIds.add(l.id);
      }
    }
  }

  let cards = 0;
  for (const c of s.cards) {
    if (!c.sourceIds.includes(factId)) continue;
    c.sharedLine = null;
    c.opener = GREETING;
    const ties = c.sourceIds.filter((id) => !factById(id)); // bridges stay; no fact sits behind a greeting
    c.sourceIds = ties.length ? ties : [removedId(factId)];
    cards++;
  }
  const scrub = (m: { text: string; sourceIds: string[] }) => {
    if (!m.sourceIds.some((id) => id === factId || lineIds.has(id))) return false;
    m.text = REMOVED;
    m.sourceIds = [];
    return true;
  };
  const messages = s.messages.filter(scrub).length;
  const pairs = s.pairs.filter(scrub).length;
  const table = s.table.filter(scrub).length;
  // The copies in the event log that phones replay on reconnect go too.
  for (const e of s.events_log) {
    if (e.type === "chat.message" || e.type === "pair.message" || e.type === "table.message") scrub(e.payload as { text: string; sourceIds: string[] });
  }
  return { factId, rewritten: { cards, messages, pairs, table } };
}
