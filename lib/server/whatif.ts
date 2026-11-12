import type { Party, QueueEntry } from "@/contracts";
import { runParty } from "@/lib/agents/orchestrator";
import { removedLabel, type WhatIfMember, type WhatIfOutcome, type WhatIfRemoved, type WhatIfResult } from "@/lib/stage/whatif";
import { withMockModel } from "@/model/client";
import { joinQueue } from "./queue";
import { ruleLabel } from "./secret";
import { profile, runIsolated, store, type Store } from "./store";
import { trace } from "./trace";

/**
 * "What if", for the projector. Re-runs the same five people, with the same
 * sentences, places and settings, in a throwaway store, with one person's
 * rule removed, and compares the outcome with tonight's. It runs on the
 * mock model (no real calls), touches no live state, and publishes nothing.
 * Projector only: on a member's phone, "what changes without my rule"
 * would hint at other people's rules.
 */

export function whatIfMembers(partyId: string): WhatIfMember[] {
  const s = store();
  const party = s.parties.get(partyId);
  if (!party) return [];
  return party.memberIds.map((id) => ({
    id,
    name: profile(id).firstName,
    rules: (s.briefs.get(`brief-${id}`)?.hardRules ?? []).filter((r) => r.kind !== "public_venue").map((r) => ({ id: r.id, label: ruleLabel(r), words: r.sourceText })),
  }));
}

function outcome(s: Store, party: Party): WhatIfOutcome {
  const title = (id: string) => s.plans.get(id)?.title ?? id;
  const unavailable = [...new Set(s.table.filter((m) => m.partyId === party.id && m.kind === "unavailable" && m.planId).map((m) => m.planId!))];
  return { locked: party.planId ? title(party.planId) : null, lockedBy: party.lockedBy, unavailable: unavailable.map(title) };
}

let running = false;
export const MAX_REMOVED = 5;

export async function whatIf(partyId: string, remove: { ownerId: string; ruleId: string }[]): Promise<WhatIfResult | { ok: false; error: string }> {
  const live = store();
  const party = live.parties.get(partyId);
  if (!party || party.status !== "locked") return { ok: false, error: "Run it after the party locks." };
  if (!remove.length || remove.length > MAX_REMOVED) return { ok: false, error: `Pick one to ${MAX_REMOVED} rules.` };
  const removed: WhatIfRemoved[] = [];
  for (const { ownerId, ruleId } of remove) {
    const rule = live.briefs.get(`brief-${ownerId}`)?.hardRules.find((r) => r.id === ruleId);
    // Safety rules (public places only) are not optional, so they can't be removed.
    if (!party.memberIds.includes(ownerId) || !rule || rule.kind === "public_venue") return { ok: false, error: "No such rule." };
    if (!removed.some((r) => r.id === rule.id)) removed.push({ ownerId, name: profile(ownerId).firstName, id: rule.id, label: ruleLabel(rule), words: rule.sourceText });
  }
  if (running) return { ok: false, error: "A sandbox run is already going." };

  // Everything the sandbox needs, copied out of the live store first.
  const people = party.memberIds.map((id) => {
    const entry = [...live.queue].reverse().find((e: QueueEntry) => e.userId === id && e.briefId === `brief-${id}`);
    const b = live.briefs.get(`brief-${id}`)!;
    return { id, profile: structuredClone(live.profiles.get(id)!), entry: entry ? { ...entry } : null, sentence: b.sentence, approved: b.shareable.filter((l) => l.approved).map((l) => l.id), joinedAt: entry?.joinedAt ?? "" };
  });
  if (people.some((p) => !p.entry)) return { ok: false, error: "Couldn't rebuild this party's queue." };
  people.sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));
  const liveOutcome = outcome(live, party);

  running = true;
  try {
    const sandbox = await withMockModel(() =>
      runIsolated(async () => {
        const s = store();
        for (const p of people) s.profiles.set(p.id, p.profile);
        for (const p of people) {
          const e = p.entry!;
          await joinQueue({ userId: p.id, eventId: e.eventId ?? party.eventId ?? "", sentence: p.sentence, consentBridges: e.consentBridges, duoWith: e.duoWith, scope: e.scope, approvedLineIds: p.approved, startTalk: false });
        }
        const same = [...s.parties.values()].find((x) => [...x.memberIds].sort().join() === [...party.memberIds].sort().join());
        if (!same) return null;
        for (const r of removed) {
          const b = s.briefs.get(`brief-${r.ownerId}`)!;
          b.hardRules = b.hardRules.filter((h) => h.id !== r.id);
        }
        await runParty(same.id, { paceMs: 0 });
        return outcome(s, s.parties.get(same.id)!);
      }),
    );
    if (!sandbox) return { ok: false, error: "The sandbox formed a different party." };
    const opened = liveOutcome.unavailable.filter((t) => !sandbox.unavailable.includes(t));
    const changed = sandbox.locked !== liveOutcome.locked;
    const r: WhatIfResult = { ok: true, removed, live: liveOutcome, sandbox, opened, changed };
    const say = changed ? `${sandbox.locked ?? "nothing"} would lock instead of ${liveOutcome.locked}.` : `${liveOutcome.locked} would still lock.`;
    trace(partyId, "private", "judge", removed.length === 1 ? removed[0]!.ownerId : null, `What if · without ${removedLabel(removed)}`, `Sandbox run (mock agents, the same code checks): ${say}${opened.length ? ` Opens up: ${opened.join(", ")}.` : " Nothing else opens up."} The live party is unchanged.`, {
      tone: "neutral",
      meta: { kind: "whatif" },
    });
    return r;
  } finally {
    running = false;
  }
}
