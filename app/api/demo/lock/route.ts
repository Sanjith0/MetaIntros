import { NextResponse } from "next/server";
import { store } from "@/lib/server/store";
import { trace } from "@/lib/server/trace";

export const dynamic = "force-dynamic";

/** Demo control: lock the talking party now. Code still picks only a plan
 *  that passes every member's rules; the rest of the run fast-forwards. */
export function POST() {
  const s = store();
  const party = [...s.parties.values()].reverse().find((p) => p.status === "forming" || p.status === "talking");
  if (!party) return NextResponse.json({ error: "no party is talking" }, { status: 409 });
  s.operator.forceLock.add(party.id);
  s.operator.fastForward.add(party.id);
  trace(party.id, "private", "judge", null, "Operator asked for the lock", "The demo operator pressed Lock now. Code will pick the best plan that passes every member's rules.", { tone: "lock" });
  return NextResponse.json({ ok: true, partyId: party.id });
}
