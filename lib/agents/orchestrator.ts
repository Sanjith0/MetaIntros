import type { Card, Party, Receipt } from "@/contracts";
import { clock12, dayLabel, price } from "@/lib/format";
import { publish } from "@/lib/server/bus";
import { postMessage, setRsvp } from "@/lib/server/social";
import { factById, nowIso, profile, store } from "@/lib/server/store";
import { trace } from "@/lib/server/trace";
import { bridgeLine, consentedBridges, openerText, runPairTalk, type PairResult } from "./pair";
import { runTableTalk, type TableOptions, type TableResult } from "./table";
import { pairKey } from "@/lib/graph";
import { flag } from "@/lib/flags";
import { chatExpiry } from "@/lib/server/clock";

export interface RunOptions extends TableOptions {}

const g = globalThis as unknown as { __pqRuns?: Map<string, Promise<void>> };
const runs = () => (g.__pqRuns ??= new Map());

/** Table talk and pair talk run side by side. Code locks the plan, then
 *  everything the five phones need is ready before MATCH FOUND goes out. */
export function runParty(partyId: string, opts: RunOptions = {}): Promise<void> {
  const key = `${store().version}:${partyId}`; // ids restart after a demo reset
  const existing = runs().get(key);
  if (existing) return existing;
  const p = (async () => {
    const s0 = store();
    const [table, pairs] = await Promise.all([runTableTalk(partyId, opts), runPairTalk(partyId, { paceMs: opts.paceMs })]);
    if (store() !== s0) return; // "Reset everything" happened mid-talk: this party no longer exists
    if (store().operator.cancelled.has(partyId)) return; // someone left before the lock
    if (!table) {
      // Imported here: the no-match handler re-forms through the queue, which imports this file.
      if (flag("NO_MATCH")) await (await import("@/lib/server/nomatch")).handleNoMatch(partyId);
      else trace(partyId, "shared", "judge", null, "No match", "No plan worked for everyone.");
      return;
    }
    finalize(partyId, table, pairs);
  })();
  runs().set(key, p);
  return p;
}

export function finalize(partyId: string, table: TableResult, pairs: PairResult[]) {
  const s = store();
  const party = s.parties.get(partyId)!;
  const plan = s.plans.get(table.planId)!;
  const lockedAt = nowIso();

  party.planId = plan.id;
  party.lockedBy = table.lockedBy;
  party.signatures = table.signatures;
  party.status = "locked";
  party.lockedAt = lockedAt;
  party.chatId = `chat-${party.id}`;

  // The plan becomes an RSVP for all five.
  for (const id of party.memberIds) setRsvp(plan.eventId, id, "going");
  for (const e of s.queue) if (party.memberIds.includes(e.userId) && e.status === "forming") e.status = "matched";

  // Cards: for each viewer and each other member, what's in common and what to say.
  s.cards = s.cards.filter((c) => c.partyId !== party.id);
  for (const pr of pairs) {
    for (const [viewer, subject] of [
      [pr.a, pr.b],
      [pr.b, pr.a],
    ] as const) {
      const opener = pr.openers[viewer]!;
      const tie = bridgeLine(party, consentedBridges(party, viewer, subject));
      const card: Card = {
        partyId: party.id,
        viewerId: viewer,
        subjectId: subject,
        subjectName: profile(subject).firstName,
        bridgeLine: tie?.text ?? null,
        sharedLine: pr.shared.text,
        opener: opener.text,
        sourceIds: [...new Set([...pr.shared.sourceIds, ...opener.sourceIds, ...(tie?.sourceIds ?? [])])],
      };
      s.cards.push(card);
    }
  }

  // Receipts: per owner, what their agent considered, rejected and said.
  for (const owner of party.memberIds) s.receipts.set(`${party.id}:${owner}`, receiptFor(party, owner, pairs));

  // The group chat: plan pinned, one opener per person.
  const chatId = party.chatId;
  s.chats.set(chatId, {
    id: chatId,
    partyId: party.id,
    title: `${plan.title} · party of 5`,
    memberIds: [...party.memberIds],
    pinnedMessageId: null,
    expiresAt: flag("CHAT_LIFECYCLE") ? chatExpiry(plan.date, plan.start, plan.end) : null,
  });
  postMessage(chatId, null, "Party Queue made this chat for your party of five.", "system");
  postMessage(
    chatId,
    null,
    `${plan.title} · ${dayLabel(plan.date)}, ${clock12(plan.start)}–${clock12(plan.end)} · ${plan.venueName} · ${price(plan.priceUsd)}`,
    "pinned",
    [plan.id],
  );
  const ids = party.memberIds;
  ids.forEach((from, i) => {
    const to = ids[(i + 1) % ids.length]!;
    const pr = pairs.find((p) => p.key === pairKey(from, to));
    const opener = pr?.openers[from];
    const fact = opener ? factById(opener.sourceIds[0]!) : undefined;
    if (opener && fact) postMessage(chatId, from, openerText(profile(to), fact), "opener", opener.sourceIds);
  });

  trace(partyId, "shared", "judge", null, "Plan locked", `${plan.title} · ${table.lockedBy === "signatures" ? "five signatures" : "code fallback"} · round ${table.rounds}`, {
    tone: "lock",
    meta: { kind: "locked", planId: plan.id, round: table.rounds },
  });
  store().table.push({
    id: `t-lock-${party.id}`,
    partyId: party.id,
    round: table.rounds,
    authorId: null,
    kind: "locked",
    text: `Locked: ${plan.title}`,
    sourceIds: [plan.id],
    planId: plan.id,
    at: lockedAt,
  });

  // plan.locked and match.found go out together.
  publish("plan.locked", { partyId: party.id, planId: plan.id, lockedBy: table.lockedBy, lockedAt }, party.memberIds, { stage: true });
  publish(
    "match.found",
    { partyId: party.id, planId: plan.id, eventId: plan.eventId, title: plan.title, venueName: plan.venueName, start: clock12(plan.start), chatId, lockedAt },
    party.memberIds,
    { stage: true },
  );
}

export function receiptFor(party: Party, ownerId: string, pairs: PairResult[]): Receipt {
  const s = store();
  const mine = s.verdicts.filter((v) => v.partyId === party.id && v.ownerId === ownerId);
  const r1 = mine.filter((v) => v.round === 1);
  const title = (id: string) => s.plans.get(id)?.title ?? id;
  const told = s.table.filter((t) => t.partyId === party.id && t.authorId === ownerId && t.kind === "line");
  const shared = pairs.flatMap((p) => [p.shared, ...Object.values(p.openers)]).flatMap((m) => m.sourceIds).filter((id) => factById(id)?.ownerId === ownerId);
  return {
    partyId: party.id,
    ownerId,
    considered: r1.map((v) => ({ planId: v.planId, title: title(v.planId), preference: v.preference })),
    rejected: r1.filter((v) => v.decision === "reject").map((v) => ({ planId: v.planId, title: title(v.planId), reason: v.privateReason, byCode: v.overriddenByCode })),
    toldParty: told.map((t) => ({ round: t.round, text: t.text, sourceIds: t.sourceIds })),
    blockedLines: s.blockedLines.filter((b) => b.partyId === party.id && b.ownerId === ownerId).length,
    fallbackRounds: [...new Set(s.agentCalls.filter((c) => c.partyId === party.id && c.ownerId === ownerId && c.source === "fallback").map((c) => c.round))],
    sharedFactIds: [...new Set(shared)],
    finalPlanId: party.planId,
  };
}
