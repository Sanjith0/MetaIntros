import { flag } from "@/lib/flags";
import { publish } from "./bus";
import { reform } from "./queue";
import { store } from "./store";
import { trace } from "./trace";

/**
 * Leave a party before its plan is locked. The talk stops, the others go
 * back to the front of the queue, and nobody is told who left: the event
 * that tells them (party.dissolved) has no field that could carry a name.
 */
export async function leaveParty(partyId: string, userId: string): Promise<{ reformedPartyId: string | null }> {
  if (!flag("CHAT_LIFECYCLE")) throw new Error("leaving is turned off");
  const s = store();
  const party = s.parties.get(partyId);
  if (!party || !party.memberIds.includes(userId)) throw new Error("not in this party");
  if (party.status === "locked") throw new Error("The plan is already set. You can tell your party in the chat.");
  if (s.operator.cancelled.has(partyId)) throw new Error("This party has already changed.");

  s.operator.cancelled.add(partyId);
  party.status = "failed";
  const others = party.memberIds.filter((id) => id !== userId);
  for (const e of s.queue) {
    if (!party.memberIds.includes(e.userId) || e.status === "left") continue;
    // The leaver is out; the others keep their place (their original join time) at the front.
    e.status = e.userId === userId ? "left" : "waiting";
  }
  trace(partyId, "shared", "formation", null, "Party changed", "Someone left before the plan was set. The other four are back at the front of the queue. Nobody was named.", { tone: "reject" });
  publish("party.dissolved", { partyId }, others, { stage: true });
  const reformedPartyId = await reform();
  return { reformedPartyId };
}
