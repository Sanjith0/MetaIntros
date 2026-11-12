import { ownerChecks, partyChecks } from "@/lib/agents/judge";
import { flag } from "@/lib/flags";
import { publish } from "./bus";
import { reform, setKey } from "./queue";
import { ruleLabel } from "./secret";
import { profile, store } from "./store";
import { trace } from "./trace";

/**
 * No plan fit all five. Code, not the model, decides what happens next:
 *  - Anyone whose own rules close every plan there is told so, privately,
 *    with their own rules. Nobody else learns it.
 *  - Everyone else goes back to the front of the queue (they keep their
 *    original join time), and these five are never put together again.
 *  - The event that tells the phones carries no reason and no name.
 */
export interface NoMatchResult {
  partyId: string;
  requeued: string[];
  nothingFits: string[];
  reformedPartyId: string | null;
}

export async function handleNoMatch(partyId: string): Promise<NoMatchResult | null> {
  const s = store();
  const party = s.parties.get(partyId);
  if (!party || !flag("NO_MATCH")) return null;
  party.status = "failed";
  const plans = party.candidatePlanIds.map((id) => s.plans.get(id)!).filter((p) => p && partyChecks(partyId, p).every((c) => c.pass));
  const nothingFits = party.memberIds.filter((id) => {
    const b = s.briefs.get(`brief-${id}`);
    return !!b && !plans.some((p) => ownerChecks(partyId, p, b).every((c) => c.pass));
  });
  const requeued = party.memberIds.filter((id) => !nothingFits.includes(id));
  for (const e of s.queue) {
    if (!party.memberIds.includes(e.userId) || e.status !== "forming") continue;
    e.status = nothingFits.includes(e.userId) ? "left" : "waiting";
  }
  s.avoidSets.add(setKey(party.memberIds));
  s.nothingFits.set(partyId, nothingFits);

  trace(
    partyId,
    "shared",
    "judge",
    null,
    "No match · nobody blamed",
    `No plan worked for all five. Nobody is told whose rules clashed. ${requeued.length} back at the front of the queue; these five won't be matched together again.`,
    { tone: "reject", meta: { kind: "nomatch" } },
  );
  for (const id of nothingFits) {
    const b = s.briefs.get(`brief-${id}`)!;
    trace(partyId, "private", "judge", id, `Nothing here fits ${profile(id).firstName}'s own rules`, `Every plan breaks at least one of ${b.hardRules.map((r) => `"${ruleLabel(r)}"`).join(", ")}. Told only ${profile(id).firstName}, with a way to queue for anywhere tonight.`, {
      tone: "reject",
    });
  }
  publish("party.nomatch", { partyId }, party.memberIds, { stage: true });
  const reformedPartyId = requeued.length ? await reform() : null;
  return { partyId, requeued, nothingFits, reformedPartyId };
}

/** What one member's phone shows after a no-match: only their own situation. */
export function noMatchView(partyId: string, viewerId: string): { requeued: boolean; ownRules: string[] | null; landmark: string; eventId: string | null } | null {
  const s = store();
  const party = s.parties.get(partyId);
  const nothing = s.nothingFits.get(partyId);
  if (!party || party.status !== "failed" || !nothing || !party.memberIds.includes(viewerId)) return null;
  const mine = nothing.includes(viewerId);
  const ev = party.eventId ? s.events.get(party.eventId) : undefined;
  return {
    requeued: !mine,
    ownRules: mine ? (s.briefs.get(`brief-${viewerId}`)?.hardRules ?? []).map(ruleLabel) : null,
    landmark: ev?.landmark ?? "here",
    eventId: party.eventId,
  };
}
