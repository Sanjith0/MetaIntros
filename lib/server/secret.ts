import type { HardRule } from "@/contracts";
import { visibleTo } from "./bus";
import { chatView } from "./social";
import { profile, store } from "./store";
import { memberPartyView } from "./views";

/**
 * "Maya's secret": what only the owner can see, next to what the rest of
 * the party actually knows about it. The second column is not a claim; it
 * is computed by scanning everything each other member can load (their
 * party view, every live event they receive, the group chat) for the
 * owner's rule words, sentence and private reasons.
 */

export interface SecretRule {
  id: string;
  label: string;
  yourWords: string;
}

export interface SecretView {
  ownerId: string;
  rules: SecretRule[];
  turnedDown: { planId: string; title: string; reason: string }[];
  /** Anything private of the owner's found in another member's data. Expected empty. */
  partyKnows: { memberId: string; memberName: string; text: string }[];
  /** What the others saw instead: plan marks with no reason and no name. */
  partySaw: string[];
  checkedMembers: number;
  checkedItems: number;
}

export function ruleLabel(r: HardRule): string {
  switch (r.kind) {
    case "end_by": {
      const [h, m] = r.value.split(":").map(Number) as [number, number];
      const hh = h % 12 === 0 ? 12 : h % 12;
      return `Done by ${hh}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h >= 12 && h < 24 ? "PM" : "AM"}`;
    }
    case "max_price":
      return `$${r.value} or less`;
    case "no_drink_minimum":
      return "No drink minimum";
    case "public_venue":
      return "Public place only";
  }
}

/** Everything one member could ever load or receive about this party. */
export function everythingVisibleTo(partyId: string, viewerId: string): { text: string; items: number } {
  const s = store();
  const view = memberPartyView(partyId, viewerId);
  const events = s.events_log.filter((e) => visibleTo(e, { userId: viewerId }));
  const chatId = s.parties.get(partyId)?.chatId;
  const chat = chatId ? chatView(chatId, viewerId) : null;
  return { text: JSON.stringify({ view, events, chat }), items: events.length + (chat?.messages.length ?? 0) + (view?.table.length ?? 0) };
}

export function secretView(partyId: string, ownerId: string): SecretView | null {
  const s = store();
  const party = s.parties.get(partyId);
  const brief = s.briefs.get(`brief-${ownerId}`);
  if (!party || !brief || !party.memberIds.includes(ownerId)) return null;

  const mine = s.verdicts.filter((v) => v.partyId === partyId && v.ownerId === ownerId);
  const secrets = [brief.sentence, ...brief.hardRules.map((r) => r.sourceText), ...mine.filter((v) => v.decision === "reject").map((v) => v.privateReason)].filter(
    (x) => x && x.trim().length >= 6,
  );

  const partyKnows: SecretView["partyKnows"] = [];
  let checkedItems = 0;
  const others = party.memberIds.filter((id) => id !== ownerId);
  for (const other of others) {
    // A generic reason can be word-for-word the other person's own; that is not a leak.
    const theirOwn = new Set([
      ...(s.briefs.get(`brief-${other}`)?.hardRules.map((r) => r.sourceText) ?? []),
      ...s.verdicts.filter((v) => v.partyId === partyId && v.ownerId === other).map((v) => v.privateReason),
    ]);
    const seen = everythingVisibleTo(partyId, other);
    checkedItems += seen.items;
    for (const secret of secrets) {
      if (theirOwn.has(secret)) continue;
      if (seen.text.includes(JSON.stringify(secret).slice(1, -1))) partyKnows.push({ memberId: other, memberName: profile(other).firstName, text: secret });
    }
  }

  return {
    ownerId,
    rules: brief.hardRules.map((r) => ({ id: r.id, label: ruleLabel(r), yourWords: r.sourceText })),
    turnedDown: mine
      .filter((v) => v.round === 1 && v.decision === "reject")
      .map((v) => ({ planId: v.planId, title: s.plans.get(v.planId)?.title ?? v.planId, reason: v.privateReason })),
    partyKnows,
    partySaw: s.table.filter((t) => t.partyId === partyId && t.kind === "unavailable").map((t) => t.text),
    checkedMembers: others.length,
    checkedItems,
  };
}
