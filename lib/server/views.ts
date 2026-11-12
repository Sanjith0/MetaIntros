import type { Card, PairMessage, Receipt, TableMessage, Trace } from "@/contracts";
import { bridgeLine, consentedBridges } from "@/lib/agents/pair";
import { person, partyForViewer, type Person } from "./social";
import { store } from "./store";
import { flag } from "@/lib/flags";
import { dayLabel } from "@/lib/format";
import { publicTraces, seatId } from "@/lib/stage/public";

/**
 * What a party member may see. Built only from public table lines, the
 * viewer's own pair talk, the viewer's own receipt and cards, and bridges
 * both people consented to show. Other members' briefs, rules, verdicts
 * and private reasons are never read here.
 */
export interface MemberPartyView {
  party: { id: string; status: string; planId: string | null; lockedBy: string | null; lockedAt: string | null; chatId: string | null; eventId: string | null };
  viewerId: string;
  members: (Person & { bridge: string | null; arrived: boolean })[];
  plans: { id: string; eventId: string; title: string; venueName: string; start: string; end: string; priceUsd: number; unavailable: boolean }[];
  table: TableMessage[];
  pairs: PairMessage[];
  cards: Card[];
  receipt: Receipt | null;
}

export function memberPartyView(partyId: string, viewerId: string): MemberPartyView | null {
  const s = store();
  const party = s.parties.get(partyId);
  if (!party || !party.memberIds.includes(viewerId)) return null;
  const table = s.table.filter((t) => t.partyId === partyId);
  const unavailable = new Set(table.filter((t) => t.kind === "unavailable" && t.planId).map((t) => t.planId!));
  const arrived = s.arrivals.get(partyId) ?? new Set<string>();
  return {
    party: { id: party.id, status: party.status, planId: party.planId, lockedBy: party.lockedBy, lockedAt: party.lockedAt, chatId: party.chatId, eventId: party.eventId },
    viewerId,
    members: party.memberIds.map((id) => {
      const tie = id === viewerId ? null : bridgeLine(party, consentedBridges(party, viewerId, id));
      return { ...person(id), bridge: tie?.text ?? null, arrived: arrived.has(id) };
    }),
    plans: party.candidatePlanIds.map((id) => {
      const p = s.plans.get(id)!;
      return { id: p.id, eventId: p.eventId, title: p.title, venueName: p.venueName, start: p.start, end: p.end, priceUsd: p.priceUsd, unavailable: unavailable.has(p.id) };
    }),
    table,
    pairs: s.pairs.filter((m) => m.partyId === partyId && m.pairKey.split("|").includes(viewerId)),
    cards: s.cards.filter((c) => c.partyId === partyId && c.viewerId === viewerId),
    receipt: s.receipts.get(`${partyId}:${viewerId}`) ?? null,
  };
}

export function memberPartyViewForViewer(viewerId: string): MemberPartyView | null {
  const p = partyForViewer(viewerId);
  return p ? memberPartyView(p.id, viewerId) : null;
}

/** The projector. Shows both lanes, including private reasoning. */
export interface StageView {
  partyId: string | null;
  members: Person[];
  plans: { id: string; title: string }[];
  traces: Trace[];
  /** F28: every party, newest first, for the projector's switcher. */
  parties?: StageParty[];
}

export interface StageParty {
  id: string;
  label: string;
  status: string;
}

/** Every party so far, newest first: "Sun · Ferry Building · talking". For the projector only. */
export function stageParties(): StageParty[] {
  const s = store();
  const word: Record<string, string> = { forming: "forming", talking: "talking", locked: "locked", failed: "no match" };
  return [...s.parties.values()].reverse().map((p) => {
    const ev = p.eventId ? s.events.get(p.eventId) : undefined;
    const day = ev ? dayLabel(ev.date).split(",")[0] : "";
    return { id: p.id, label: `${day} · ${ev?.landmark ?? "?"} · ${word[p.status] ?? p.status}`, status: p.status };
  });
}

/** F46: the stage for anyone in the room. Anonymous seats, code's rows, decisions without words. */
export function publicStageView(partyId?: string): StageView {
  const v = stageView(partyId);
  const party = v.partyId ? store().parties.get(v.partyId) : undefined;
  if (!party) return v;
  return {
    ...v,
    members: party.memberIds.map((id, i) => ({ id: seatId(party.memberIds, id), name: `Seat ${i + 1}`, firstName: `Seat ${i + 1}`, hue: 260 })),
    traces: publicTraces(v.traces, party.memberIds),
  };
}

export function stageView(partyId?: string): StageView {
  const s = store();
  const party = partyId ? s.parties.get(partyId) : [...s.parties.values()].at(-1);
  const parties = flag("STAGE_PARTIES") ? stageParties() : undefined;
  if (!party) return { partyId: null, members: [], plans: [], traces: [], parties };
  return {
    parties,
    partyId: party.id,
    members: party.memberIds.map(person),
    plans: party.candidatePlanIds.map((id) => ({ id, title: s.plans.get(id)?.title ?? id })),
    traces: s.traces.filter((t) => t.partyId === party.id),
  };
}
