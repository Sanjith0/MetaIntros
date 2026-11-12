import type { Trace } from "@/contracts";

/**
 * The public stage, enforced on the server (F46). What a phone in the room
 * may receive: code's rows about plans (shared lane, no agent, no pair talk),
 * and each agent's decision as an anonymous seat with no words (so the board
 * can count signatures). Everything else, including every private row, every
 * agent's line and all pair talk, is never sent.
 */
export function publicTrace(t: Trace, seatOf: (id: string) => string): Trace | null {
  if (t.lane === "shared" && t.actorId === null && t.conversation !== "pair") return t;
  if (t.meta?.kind === "verdicts" && t.actorId) {
    return {
      id: t.id,
      partyId: t.partyId,
      seq: t.seq,
      lane: "private",
      conversation: "table",
      actorId: seatOf(t.actorId),
      title: "",
      body: "",
      at: t.at,
      meta: { kind: "verdicts", round: t.meta.round, decision: t.meta.decision, planId: t.meta.planId },
    };
  }
  if (t.meta?.kind === "rogue") return { ...t, actorId: null };
  return null;
}

export const seatId = (memberIds: string[], id: string) => `seat-${memberIds.indexOf(id) + 1}`;

export function publicTraces(traces: Trace[], memberIds: string[]): Trace[] {
  return traces.map((t) => publicTrace(t, (id) => seatId(memberIds, id))).filter((t): t is Trace => t !== null);
}
