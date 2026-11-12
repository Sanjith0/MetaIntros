import type { Trace } from "@/contracts";

/** What the stage board shows at one point in the replay. Pure, so the
 *  scrubber can rebuild it at any trace index. */
export interface BoardState {
  round: number;
  unavailable: string[];
  leading: string | null;
  locked: string | null;
  /** For the current round only: who has signed, conceded or is holding. */
  signatures: Record<string, "signed" | "conceded" | "holding">;
  rejections: number;
  blocks: number;
  done: boolean;
}

export function boardAt(traces: Trace[], upto: number): BoardState {
  const st: BoardState = { round: 0, unavailable: [], leading: null, locked: null, signatures: {}, rejections: 0, blocks: 0, done: false };
  for (const t of traces.slice(0, Math.max(0, upto))) {
    const m = t.meta ?? {};
    if (t.tone === "block") st.blocks++;
    switch (m.kind) {
      case "verdicts":
        if (m.round) st.round = Math.max(st.round, m.round);
        if (m.round === 1 && t.tone === "reject") st.rejections++;
        if (m.round && m.round >= 2 && t.actorId && m.decision) {
          st.signatures[t.actorId] = m.decision === "sign" ? "signed" : m.decision === "concede" ? "conceded" : "holding";
        }
        break;
      case "unavailable":
        if (m.planId && !st.unavailable.includes(m.planId)) st.unavailable.push(m.planId);
        break;
      case "leading":
        st.leading = m.planId ?? null;
        st.signatures = {};
        if (m.round) st.round = m.round;
        break;
      case "locked":
        st.locked = m.planId ?? null;
        st.done = true;
        break;
      case "switched": // F54: the party moved to plan B
        st.locked = m.planId ?? st.locked;
        break;
    }
  }
  return st;
}

/** Delay before showing trace i+1 during a replay, from the recorded timing. */
export function replayDelay(traces: Trace[], i: number, speed: number): number {
  const a = traces[i];
  const b = traces[i + 1];
  if (!a || !b) return 400 / speed;
  const gap = Date.parse(b.at) - Date.parse(a.at);
  return Math.max(60, Math.min(1500, gap)) / speed;
}
