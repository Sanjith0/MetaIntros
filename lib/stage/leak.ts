/** Shared by the server and the stage: the result of "Try to leak it". No server imports. */

export interface LeakAttempt {
  partyId: string;
  actorId: string;
  text: string;
  /** Private words in the typed line, and whose they are (shown on the projector only). */
  holds: { ownerId: string; name: string; text: string }[];
  /** The agent's own latest prompt: how many of the others' private phrases it held (null if none kept). */
  promptOthers: number | null;
  ok: boolean;
  /** The verifier's own reason, and the same in plain words for the room. */
  reason: string | null;
  plain: string | null;
  /** What the other four would have seen at the table. */
  tableSees: string;
}

/** "Maya's private words “out by eleven”, “nowhere I have to drink”", grouped by owner. */
export function heldWords(holds: LeakAttempt["holds"]): string {
  const by = new Map<string, string[]>();
  for (const h of holds) by.set(h.name, [...(by.get(h.name) ?? []), `“${h.text}”`]);
  return [...by].map(([name, ws]) => `${name}'s private words ${ws.join(", ")}`).join("; ");
}
