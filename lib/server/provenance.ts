import type { Party } from "@/contracts";
import { bridgeText } from "@/lib/agents/pair";
import type { SourceItem } from "@/lib/stage/provenance";
import { factById, profile, store } from "./store";

export type { SourceItem };

/**
 * "Why this line?" for a card, an opener or a shared line. Every machine
 * sentence carries the ids it was built from; this turns them back into
 * plain words for the person reading it: whose fact, and that they
 * approved sharing it. It never names a third person who hasn't opted
 * in (a tie says only what its line says) and never shows an id.
 */
export function explainSources(sourceIds: string[], viewerId: string, partyId: string): SourceItem[] {
  const s = store();
  const party: Party | undefined = s.parties.get(partyId);
  const out: SourceItem[] = [];
  for (const id of sourceIds) {
    const fact = factById(id);
    if (fact) {
      const mine = fact.ownerId === viewerId;
      const who = mine ? "You" : profile(fact.ownerId).firstName;
      const ok = fact.approved && (!party || party.memberIds.includes(fact.ownerId));
      const text =
        fact.source === "brief"
          ? `${who} approved the line “${fact.text}”${mine ? " from your sentence" : ""}${mine || !/[.!?]$/.test(fact.text) ? "." : ""}`
          : `${who} listed “${fact.tag}”${fact.source === "fair" ? " on the fair form" : mine ? " on your profile" : " on their profile"} and approved sharing it.`;
      out.push({ kind: "fact", text: ok ? text : "A source that wasn't approved.", ok });
      continue;
    }
    const tie = party?.bridges.find((b) => b.id === id);
    if (tie) {
      const line = bridgeText(tie, party);
      const how = tie.kind === "group" ? "Code found a small Group you're both in." : tie.kind === "queued_together" ? "You two queued together." : line.startsWith("You both know") ? "Code found a friend you share, who agreed to be named." : "Code found a friend you share. They aren't named: they haven't opted in.";
      out.push({ kind: "tie", text: how, ok: true });
      continue;
    }
    const plan = s.plans.get(id);
    if (plan) {
      out.push({ kind: "plan", text: `Your party's plan: ${plan.title}.`, ok: true });
      continue;
    }
    out.push({ kind: "unknown", text: "A source this app can't explain.", ok: false });
  }
  return out;
}
