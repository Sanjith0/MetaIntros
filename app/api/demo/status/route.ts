import { NextResponse } from "next/server";
import { DEMO_IDS } from "@/fixtures";
import { frameSource } from "@/lib/door/source";
import { connected } from "@/lib/server/phones";
import { store } from "@/lib/server/store";
import { boardAt } from "@/lib/stage/board";
import { modelSettings } from "@/model/settings";
import { modelConfig } from "@/model/client";

export const dynamic = "force-dynamic";

/** Everything the demo control panel shows, in one poll. */
export function GET() {
  const s = store();
  const party = [...s.parties.values()].at(-1) ?? null;
  const traces = party ? s.traces.filter((t) => t.partyId === party.id) : [];
  const board = boardAt(traces, traces.length);
  const waiting = s.queue.filter((q) => q.status === "waiting");
  return NextResponse.json({
    storeVersion: s.version,
    waiting: waiting.map((q) => ({ userId: q.userId, landmark: q.landmark })),
    party: party
      ? {
          id: party.id,
          status: party.status,
          round: board.round,
          plan: party.planId ? s.plans.get(party.planId)?.title ?? null : null,
          lockedBy: party.lockedBy,
          forced: s.operator.forceLock.has(party.id),
        }
      : null,
    phones: DEMO_IDS.map((id) => ({ id, connected: connected(id) })),
    settings: modelSettings(),
    mockModel: modelConfig().mock,
    frameSource: frameSource(),
  });
}
